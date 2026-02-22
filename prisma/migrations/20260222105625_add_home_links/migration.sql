CREATE TABLE "HomeLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "section" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "HomeLink_section_url_key" ON "HomeLink"("section", "url");
CREATE INDEX "HomeLink_section_position_createdAt_idx" ON "HomeLink"("section", "position", "createdAt");

INSERT INTO "HomeLink" ("id", "section", "url", "position", "createdAt", "updatedAt") VALUES
  ('cmh0writingpub001', 'writing', 'https://www.post-gazette.com/ae/books/2025/08/24/matthew-frank-submersed-wonder-obsession-review-joshua-graber/stories/202508240053', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmh0writingpub002', 'writing', 'https://www.post-gazette.com/ae/books/2025/05/31/laurence-leamer-muses-andy-warhol/stories/202506010061', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmh0writingpub003', 'writing', 'https://www.theadroitjournal.org/2025/03/24/a-review-of-alex-higleys-true-failure/', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmh0writingpub004', 'writing', 'https://www.post-gazette.com/ae/books/2024/04/27/review-mara-van-der-lugt-begetting-what-does-it-mean-to-create-a-child/stories/202404280037', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmh0writingpub005', 'writing', 'https://www.artreview.com/genre-and-the-newer-newness-danielle-dutton-prairie-dresses-art-other-review/', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmh0writingpub006', 'writing', 'https://www.mrbullbull.com/newbull/fiction/metaphors-toward-__________________', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
