import { createController } from 'remix/router'

import { currentUser, getViewer } from '../../auth/identity.ts'
import { getCatalog } from '../../content/request.ts'
import { routes } from '../../routes.ts'
import { StatusPage } from '../../ui/not-found-page.tsx'
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
          <StatusPage
            title="Certificate not found"
            code="404"
            eyebrow="No certificate"
            heading="There’s no certificate here."
            hint="It appears once every lesson of a course is finished, on a public profile."
            viewer={viewer}
            currentPath={context.url.pathname}
          />,
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
