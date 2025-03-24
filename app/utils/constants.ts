
/* TODO: add to DB, create admin route to update these without needing to trigger a new build. 
* Also attempt to update the link preview logic. Fetch in the loader so that we don't have to cache */
export const RECENT_PUBLICATIONS = [
"https://www.theadroitjournal.org/2025/03/24/a-review-of-alex-higleys-true-failure/",
"https://www.post-gazette.com/ae/books/2024/04/27/review-mara-van-der-lugt-begetting-what-does-it-mean-to-create-a-child/stories/202404280037",
"https://www.artreview.com/genre-and-the-newer-newness-danielle-dutton-prairie-dresses-art-other-review/",
"https://www.mrbullbull.com/newbull/fiction/metaphors-toward-__________________"
];

export const TRUSTED_IMAGE_DOMAINS = [
  'https://www.wp.org',
  ...RECENT_PUBLICATIONS
].map((url) => {
  const hostname = new URL(url).hostname;
  // Replace any subdomain (including www) with * but don't add trailing wildcard
  return hostname.replace(/^[^.]+\./, '*.');
});
