import { css } from 'remix/component'
import { EmptyState } from '@bits/ui/empty-state'
import { Keycap } from '@bits/ui/keycap'
import { createController } from 'remix/router'

import { currentUser, getViewer } from '../../auth/identity.ts'
import { getCatalog } from '../../content/request.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { CertificatePage } from './certificate-page.tsx'
import { getCertificate } from './data.ts'

// /u/:handle/certificates/:course. Unknown handle, private profile, unknown
// or unfinished course: the same 404, so none of them can be probed.
export default createController(routes.certificates, {
  actions: {
    async show(context) {
      let viewer = getViewer(context)
      let { handle, course } = context.params
      let certificate = await getCertificate(context.db, await getCatalog(context), handle, course, currentUser(context))
      if (!certificate) {
        return context.render(
          <Layout title="Certificate not found" viewer={viewer} currentPath={context.url.pathname}>
            <div mix={notFoundStyle}>
              <h1 class="sr-only">Certificate not found</h1>
              <EmptyState
                title="There’s no certificate here."
                hint="It appears once every lesson of a course is finished, on a public profile."
                action={
                  <Keycap variant="ghost-mono" href={routes.courses.index.href()}>
                    Browse courses →
                  </Keycap>
                }
              />
            </div>
          </Layout>,
          { status: 404 },
        )
      }
      let path = routes.certificates.show.href({ handle: certificate.handle, course: certificate.course.slug })
      return context.render(
        <CertificatePage
          certificate={certificate}
          viewer={viewer}
          shareUrl={new URL(path, context.url).href}
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})

const notFoundStyle = css({ maxWidth: '640px', margin: '0 auto' })
