import { Link } from 'react-router-dom'

/**
 * Public on purpose: Google requires a privacy-policy link on the OAuth consent
 * screen, so this must be reachable without signing in.
 *
 * Deliberately short and concrete rather than a wall of legalese. It is also accurate:
 * everything below describes what the code actually does, and it should be updated when
 * that changes — particularly if analytics or any third-party script is ever added.
 */
export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
        ← Real Maths
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-slate-900">Privacy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: September 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="text-base font-semibold text-slate-900">What we store</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Your name and email address</strong>, which Google shares with us when you sign in, so
              we can identify your account.
            </li>
            <li>
              <strong>Your answers</strong> to quiz questions, and the points, streak and per-topic totals
              that follow from them — that is the point of the app.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">What we do not do</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>We do not store passwords. Sign-in is handled entirely by Google.</li>
            <li>We do not use advertising or third-party analytics, and we do not track you across other sites.</li>
            <li>We do not sell or share your data with anyone.</li>
            <li>
              We do not ask for access to your Gmail, files, calendar or anything else in your Google account.
              We only receive your name and email address.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">Where it is kept</h2>
          <p className="mt-3">
            On a single server we run ourselves, in a database file that only this application can read.
            It is not stored with Google, and it is not shared with any other service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">Deleting your data</h2>
          <p className="mt-3">
            Email us and we will delete your account and everything stored with it. You can also revoke this
            app's access at any time from your Google account permissions page; doing so stops you signing in
            but does not by itself remove the data we already hold, so ask us as well if you want it gone.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">If you are under 16</h2>
          <p className="mt-3">
            Please ask a parent, carer or teacher before creating an account.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">Contact</h2>
          <p className="mt-3">
            {/* TODO: replace with a working address before publishing. A privacy policy
                with an unreachable contact is worse than none, and Google's reviewers
                check that these links resolve. */}
            <a href="mailto:privacy@thinktalkbuild.com" className="font-medium text-indigo-600 hover:text-indigo-700">
              privacy@thinktalkbuild.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
