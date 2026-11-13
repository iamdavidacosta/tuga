$ErrorActionPreference = 'Stop'

$containerName = 'supabase_db_tuga'
$userId = '10101010-1010-4010-8010-101010101010'
$medicationId = 'a0000000-0000-4000-8000-000000000010'
$scheduleId = 'b0000000-0000-4000-8000-000000000010'
$occurrenceId = 'c0000000-0000-4000-8000-000000000010'
$subscriptionId = 'd0000000-0000-4000-8000-000000000010'

function Invoke-LocalPsql {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $output = docker exec $containerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $Sql
  if ($LASTEXITCODE -ne 0) { throw 'Falló una consulta en la base local de pruebas.' }
  return ($output | Out-String).Trim()
}

try {
  Invoke-LocalPsql "delete from auth.users where id = '$userId'; insert into auth.users (id, email) values ('$userId', 'notification-concurrency@example.com'); insert into public.medications (id,user_id,name,dosage_amount,dosage_unit,start_date,status) values ('$medicationId','$userId','Concurrencia push',1,'tableta',current_date,'active'); insert into public.medication_schedules (id,medication_id,user_id,schedule_type,local_times,timezone,effective_from,treatment_start,medication_name,dosage_amount,dosage_unit) values ('$scheduleId','$medicationId','$userId','daily',array['08:00'::time],'America/Bogota',current_date::timestamp at time zone 'America/Bogota',current_date,'Concurrencia push',1,'tableta'); insert into public.dose_occurrences (id,medication_id,schedule_id,user_id,scheduled_at,medication_name,dosage_amount,dosage_unit) values ('$occurrenceId','$medicationId','$scheduleId','$userId',clock_timestamp()-interval '1 minute','Concurrencia push',1,'tableta'); insert into public.push_subscriptions (id,user_id,endpoint,p256dh,auth_key,device_label) values ('$subscriptionId','$userId','https://push.example.test/concurrency',repeat('A',65),repeat('B',16),'Prueba');" | Out-Null

  $firstSql = "begin; set role service_role; set request.jwt.claim.role = 'service_role'; select count(*) from public.claim_due_notification_deliveries(100); select pg_sleep(2); commit;"
  $secondSql = "begin; set role service_role; set request.jwt.claim.role = 'service_role'; select count(*) from public.claim_due_notification_deliveries(100); commit;"
  $first = Start-Job -ScriptBlock { param($container, $sql) docker exec $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $sql } -ArgumentList $containerName, $firstSql
  Start-Sleep -Milliseconds 250
  $second = Start-Job -ScriptBlock { param($container, $sql) docker exec $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $sql } -ArgumentList $containerName, $secondSql
  Wait-Job -Job $first, $second | Out-Null
  $firstOutput = (Receive-Job -Job $first | Out-String)
  $secondOutput = (Receive-Job -Job $second | Out-String)
  if ($first.State -ne 'Completed' -or $second.State -ne 'Completed') { throw 'Una ejecución concurrente falló.' }
  Remove-Job -Job $first, $second

  $claimedCounts = [regex]::Matches("$firstOutput`n$secondOutput", '(?m)^\s*([01])\s*$')
  $claimedTotal = ($claimedCounts | ForEach-Object { [int]$_.Groups[1].Value } | Measure-Object -Sum).Sum
  $databaseResult = Invoke-LocalPsql "select count(*) || '|' || max(attempt_count) || '|' || max(status) from public.notification_deliveries where occurrence_id = '$occurrenceId';"
  if ($claimedTotal -ne 1 -or $databaseResult -ne '1|1|processing') {
    throw "Resultado concurrente inesperado: claims=$claimedTotal, db=$databaseResult"
  }
  Write-Output 'PASS: dos programadores simultáneos crearon y reclamaron una sola entrega.'
}
finally {
  Invoke-LocalPsql "delete from auth.users where id = '$userId';" | Out-Null
}
