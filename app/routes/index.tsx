import { useLoaderData, Link } from 'react-router'
import { ClientOnly } from 'remix-utils/client-only'
import { LinkPreview } from '#app/components/link-preview'
import { Spacer } from '#app/components/spacer'
import { prisma } from '#app/utils/db.server'
import { Time } from './fragments+/__time'

const RECENT_PUBLICATIONS = [
  "https://www.post-gazette.com/ae/books/2025/07/20/ben-weissenbach-north-to-future-online-joshua-graber/stories/202507200058",
  "https://www.post-gazette.com/ae/books/2025/05/31/laurence-leamer-muses-andy-warhol/stories/202506010061",
  "https://www.theadroitjournal.org/2025/03/24/a-review-of-alex-higleys-true-failure/",
  "https://www.post-gazette.com/ae/books/2024/04/27/review-mara-van-der-lugt-begetting-what-does-it-mean-to-create-a-child/stories/202404280037",
  "https://www.artreview.com/genre-and-the-newer-newness-danielle-dutton-prairie-dresses-art-other-review/",
  "https://www.post-gazette.com/ae/books/2025/02/02/review-dose-effect-optimize-dopamine-oxytocin-serotonin-endorphins-tj-power/stories/202502020045",
  "https://www.mrbullbull.com/newbull/fiction/metaphors-toward-__________________"
  ];
  
// const TRUSTED_IMAGE_DOMAINS = [
//     'https://www.wp.org',
//     ...RECENT_PUBLICATIONS
//   ].map((url) => {
//     const hostname = new URL(url).hostname;
//     return hostname.replace(/^[^.]+\./, '*.');
//   });

export async function loader() {
  const recentFragments = await prisma.post.findMany({
    where: {
      publishAt: {
        not: null,
        lte: new Date(), // less than or equal to current time
      },
    },
    orderBy: {
      publishAt: 'desc',
    },
    take: 3,
  })

  return { fragments: recentFragments, recentPubs: RECENT_PUBLICATIONS }
}

export default function Index() {
  const data = useLoaderData<typeof loader>()

  return (
    <main className="container">
      <Spacer size="4xs" />
      <h1>Joshua D. Graber</h1>
      <Spacer size="4xs" />
      <p>
        Hi I&apos;m Joshua. I currently work as a writer, editor, and
        software engineer, with a career that spans storytelling, tech, and education. Along the way, I&apos;ve also
        worked as a professor, activist, tutor, bartender, landscaper, farmhand,
        and dishwasher, amongst other things. I like to think all of this experience informs the work
        I do today.
        <Spacer size="4xs" />
      </p>
      <Spacer size="2xs" />
      {/* Writing */}
      <h2 id="writing">Writing</h2>
      <Spacer size="4xs" />
      <p>
        I&apos;m trained as a fiction writer (M.F.A.,{' '}
        <a
          href="https://www.writing.pitt.edu/graduate"
          rel="noreferrer noopener"
          target="blank"
        >
          University of Pittsburgh
        </a>
        ) and have published fiction, poetry, essays, and genre-bending work in
        journals and publications including <em>Guernica</em>, <em>diagram</em>,{' '}
        <em>Glimmer Train</em>, <em>The New Guard Review</em>
        &apos;s BANG!, the Pittsburgh <em>Post Gazette</em>, <em>Adroit Journal</em>, and{' '}
        <em>Art Review</em>.
        <Spacer size="4xs" />I also write and produce audio documentary, and I'm
        a founder of the storytelling collective{' '}
        <a
          href="https://www.coolmolecules.media/"
          rel="noreferrer noopener"
          target="blank"
        >
          Cool Molecules Media
        </a>
        .
      </p>
      <Spacer size="3xs" />
      <h3>Recent fragments</h3>
      <Link to="fragments">View all fragments</Link>

      <ol className="my-4 grid list-decimal grid-cols-1 gap-x-2 space-y-2 pl-6 md:grid-cols-2 md:gap-x-8 lg:grid-cols-3">
        {data.fragments.map(({ title, description, slug, publishAt }) => {
          return (
            <li key={title + slug} className="display-list-item">
              <Link
                prefetch="intent"
                to={`/fragments/${slug}`}
                className="flex flex-col no-underline hover:underline"
              >
                <h4>{title}</h4>
                {description && <p>{description}</p>}
                {publishAt && <Time time={publishAt.toDateString()} />}
              </Link>
            </li>
          )
        })}
      </ol>
      <Spacer size="3xs" />
      <h3>Some recent publications</h3>
      <ClientOnly fallback={null}>
        {() => {
          return (
            <ul className="[&>*]:shrink-1 flex flex-wrap gap-4 [&>*]:grow [&>*]:basis-[450px] [&>*]:sm:shrink-0">
              {data.recentPubs.map((url) => {
                return (
                  <li key={url}>
                    <LinkPreview
                      className="max-w-3xl"
                      url={url}
                    />
                  </li>
                )
              })}
            </ul>

          )
        }}
      </ClientOnly>
      <Spacer size="2xs" />
      {/* Software */}
      <h2 id="software">Software</h2>
      <Spacer size="4xs" />
      <p>
        I currently work as a software engineer for{' '}
        <a href="https://www.aura.com" rel="noreferrer noopener" target="blank">
          Aura
        </a>
        , a consumer digital security company.
        <Spacer size="4xs" />I also maintain the open-source client applications
        for the{' '}
        <a href="https://www.pdap.io" rel="noreferrer noopener" target="blank">
          Police Data Accessibility Project
        </a>
        , dedicated to making police data accessible to researchers,
        journalists, and communities impacted by policing.
        <Spacer size="4xs" />I am occasionally available for engineering
        projects on a freelance basis. Please{' '}
        <Link
					to="contact"
        >
          get in touch
        </Link>{' '}
        if you are interested in collaborating.
      </p>
      <Spacer size="2xs" />
      {/* Editing */}
      <h2 id="editing">Editing</h2>
      <Spacer size="4xs" />
      <p>
        For nearly 15 years, I’ve worked as a literary editor of prose and
        poetry. As an undergraduate, I became the founding executive editor of{' '}
        <em>The Quaker</em>.
        <Spacer size="4xs" />
        In graduate school, I served as fiction editor for{' '}
        <a
          href="https://en.wikipedia.org/wiki/Hot_Metal_Bridge_(journal)/"
          rel="noreferrer noopener"
          target="blank"
        >
          <em>Hot Metal Bridge</em>
        </a>{' '}
        and as managing editor for{' '}
        <a
          href="https://asterixjournal.com/"
          rel="noreferrer noopener"
          target="blank"
        >
          <em>Aster(ix)</em>
        </a>
        .
        <Spacer size="4xs" />
        After earning my degree, I became the founding fiction editor of{' '}
        <a
          href="https://www.wordwest.co"
          rel="noreferrer noopener"
          target="blank"
        >
          Word West Press
        </a>
        , working on an array of remarkable books across styles and genres.
        <Spacer size="4xs" />
        I&apos;m available for freelance editorial work&mdash;
        <Link
          to="contact"
        >
          say hello
        </Link>{' '}
        or check out{' '}
        <a
          href="https://reedsy.com/joshua-graber"
          rel="noreferrer noopener"
          target="blank"
        >
          my profile on Reedsy
        </a>
        .
      </p>
      <Spacer size="2xs" />
      {/* Misc. */}
      <h2>Teaching and speaking</h2>
      <Spacer size="4xs" />
      <p>
        Every now and then, I put my professor hat back on and teach writing
        workshops or programming courses. If you’re looking for an engaging,
        improvisational speaker,{' '}
        <Link
					to="contact"
        >
          let&apos;s chat
        </Link>
        .
      </p>
      <Spacer size="lg" />
    </main>
  )
}
