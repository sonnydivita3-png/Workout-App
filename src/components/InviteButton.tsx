import { shareInvite } from '../lib/invite'
import { useToasts } from '../toastStore'

const MESSAGES = {
  copied: { title: 'Invite copied 📋', body: 'Paste it in a text or group chat.' },
  failed: { title: 'Couldn’t share', body: 'Your browser blocked sharing and copying. Try again from the installed app.' },
}

/** Share a link to the app. With a handle, the person who opens it can add you as a friend in one tap. */
export function InviteButton({ handle, className, children }: { handle?: string; className: string; children: React.ReactNode }) {
  const share = async () => {
    const r = await shareInvite(handle)
    if (r === 'copied' || r === 'failed') useToasts.getState().push({ id: 'invite', ...MESSAGES[r] })
  }
  return <button onClick={share} className={className}>{children}</button>
}
