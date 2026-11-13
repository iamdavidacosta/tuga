import type { User } from '@supabase/supabase-js'

interface UserProfileCardProps {
  user: User
}

function getUserDisplayName(user: User): string {
  const metadataName = user.user_metadata.full_name ?? user.user_metadata.name

  return typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim()
    : 'Usuario de TUGA'
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  return (
    <section className="profile-card" aria-labelledby="profile-title">
      <p className="card-kicker">Tu perfil</p>
      <h2 className="tuga-heading" id="profile-title">
        {getUserDisplayName(user)}
      </h2>
      {user.email ? <p className="supporting-text">{user.email}</p> : null}
      <p className="profile-privacy-note">
        Solo tú puedes ver los datos asociados a esta cuenta.
      </p>
    </section>
  )
}
