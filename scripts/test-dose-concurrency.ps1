$ErrorActionPreference = 'Stop'

$containerName = 'supabase_db_tuga'
$userId = '77777777-7777-7777-7777-777777777777'
$medicationId = 'aaaaaaaa-0000-0000-0000-000000000077'

function Invoke-LocalPsql {
  param([Parameter(Mandatory = $true)][string]$Sql)

  $output = docker exec $containerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $Sql
  if ($LASTEXITCODE -ne 0) { throw 'Falló una consulta en la base local de pruebas.' }
  return ($output | Out-String).Trim()
}

try {
  Invoke-LocalPsql "delete from auth.users where id = '$userId'; insert into auth.users (id, email) values ('$userId', 'concurrency-test@example.com');"
  $occurrenceId = Invoke-LocalPsql "set role authenticated; set request.jwt.claim.sub = '$userId'; select public.create_medication_with_schedule('$medicationId', 'Concurrencia', 1, 'tableta', current_date, current_date, jsonb_build_object('kind','days','amount',1,'boundary','inclusive'), 'daily', array['23:59'::time], 'America/Bogota', jsonb_build_object('mode','fixed')); select id from public.dose_occurrences where medication_id = '$medicationId' limit 1;"
  $occurrenceId = ($occurrenceId -split "`r?`n")[-1]
  if ($occurrenceId -notmatch '^[0-9a-f-]{36}$') { throw 'No se generó la ocurrencia local para la prueba.' }

  $firstSql = "begin; set role authenticated; set request.jwt.claim.sub = '$userId'; select occurrence_status from public.confirm_dose_occurrence('$occurrenceId'); select pg_sleep(2); commit;"
  $secondSql = "begin; set role authenticated; set request.jwt.claim.sub = '$userId'; select occurrence_status from public.confirm_dose_occurrence('$occurrenceId'); commit;"

  $first = Start-Job -ScriptBlock { param($container, $sql) docker exec $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $sql } -ArgumentList $containerName, $firstSql
  Start-Sleep -Milliseconds 250
  $second = Start-Job -ScriptBlock { param($container, $sql) docker exec $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $sql } -ArgumentList $containerName, $secondSql
  Wait-Job -Job $first, $second | Out-Null
  Receive-Job -Job $first, $second | Out-Null
  if ($first.State -ne 'Completed' -or $second.State -ne 'Completed') { throw 'Una confirmación concurrente falló.' }
  Remove-Job -Job $first, $second

  $result = Invoke-LocalPsql "select status || '|' || (select count(*) from public.dose_occurrence_events where occurrence_id = '$occurrenceId') from public.dose_occurrences where id = '$occurrenceId';"
  if ($result -ne 'taken|1') { throw "Resultado concurrente inesperado: $result" }
  Write-Output 'PASS: dos confirmaciones simultáneas dejaron una toma realizada y un solo evento.'
}
finally {
  Invoke-LocalPsql "delete from auth.users where id = '$userId';" | Out-Null
}
