import fs from 'fs/promises'
import path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { addDays, format } from 'date-fns'
import { promiseHash } from 'remix-utils/promise'
import { prisma } from '#app/utils/db.server.ts'
import { MOCK_CODE_GITHUB } from '#app/utils/providers/constants'
import { createPassword, img } from '#tests/db-utils.ts'
import { insertGitHubUser } from '#tests/mocks/github.ts'

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? '',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
})

async function uploadToS3(filepath: string, contentType: string) {
  const filename = path.basename(filepath)
  const key = `seed/${Date.now()}-${filename}`
  const fileBuffer = await fs.readFile(filepath)

  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  }))

  return key
}

async function seed() {
	console.log('🌱 Seeding...')
	console.time(`🌱 Database has been seeded`)

	// First create the roles
	console.time('👑 Creating roles...')
	await prisma.role.createMany({
		data: [{ name: 'admin' }, { name: 'user' }],
	})
	console.timeEnd('👑 Creating roles...')

	// Create post images
  // Create post images
  console.time('🖼️ Creating post images...')
  const postImagesHash = await promiseHash({
    birthdayCat: img({
      filepath: './tests/fixtures/images/post/cat_birthday.png',
      altText: 'Grey cat with birthday hat licking its lips',
      title: 'Birthday cat',
    }),
    hammockCat: img({
      filepath: './tests/fixtures/images/post/cat_hammock.png',
      altText: 'A cat in a hammock',
      title: 'Hammock cat',
    }),
    hipsterCat: img({
      filepath: './tests/fixtures/images/post/cat_hipster.png',
      altText: 'Hipster cat looking pensively into the distance',
      title: 'Hipster cat',
    }),
  })

  // Upload images to S3 and create DB records
  const [birthdayCatImage, hammockCatImage, hipsterCatImage] = await Promise.all([
    prisma.postImage.create({
      data: {
        ...postImagesHash.birthdayCat,
        s3Key: await uploadToS3(
          './tests/fixtures/images/post/cat_birthday.png',
          'image/png'
        ),
      },
    }),
    prisma.postImage.create({
      data: {
        ...postImagesHash.hammockCat,
        s3Key: await uploadToS3(
          './tests/fixtures/images/post/cat_hammock.png',
          'image/png'
        ),
      },
    }),
    prisma.postImage.create({
      data: {
        ...postImagesHash.hipsterCat,
        s3Key: await uploadToS3(
          './tests/fixtures/images/post/cat_hipster.png',
          'image/png'
        ),
      },
    }),
  ])
  console.timeEnd('🖼️ Creating post images...')


	console.time(`🐨 Created admin user "kody"`)
	const kodyImages = await promiseHash({
		kodyUser: img({ filepath: './tests/fixtures/images/user/kody.png' }),
	})

	const githubUser = await insertGitHubUser(MOCK_CODE_GITHUB)

	const kody = await prisma.user.create({
		select: { id: true },
		data: {
			email: 'kody@example.com',
			username: 'kody',
			name: 'Kody',
			image: { create: kodyImages.kodyUser },
			password: { create: createPassword('kodylovesyou') },
			connections: {
				create: { providerName: 'github', providerId: githubUser.profile.id },
			},
			roles: { connect: [{ name: 'admin' }, { name: 'user' }] },
		},
	})
	console.timeEnd(`🐨 Created admin user "kody"`)

	console.time('📝 Creating posts...')
	await prisma.post.createMany({
		data: [
			{
				authorId: kody.id,
				publishAt: new Date().toISOString(),
				slug: 'birthday-cat',
				title: 'Birthday cat',
				description: 'About to eat some cake',
				content: `---
title: Birthday cat
slug: birthday-cat
description: About to eat some cake
published: ${format(new Date().toISOString(), 'yyyy-MM-dd')}
---

***

## It's this cat's birthday today

![${birthdayCatImage.altText}](/resources/post-images/${birthdayCatImage.id} "${birthdayCatImage.title}")

Everybody raise your glass to the kitty of the hour.`,
			},
			{
				authorId: kody.id,
				publishAt: addDays(new Date(), -1).toISOString(),
				slug: 'hammock-cat',
				title: 'Hammock Cat',
				description: 'Have you ever seen a cat in a hammock?',
				content: `---
title: Hammock Cat
slug: hammock-cat
description: Have you ever seen a cat in a hammock?
published: ${format(addDays(new Date(), -1).toISOString(), 'yyyy-MM-dd')}
---

***

## Lounging

![${hammockCatImage.altText}](/resources/post-images/${hammockCatImage.id} "${hammockCatImage.title}")

Ever had a lounge in a hammock? Above the dogs. Below the birds. Heaven
#### You can check out a few more crazy cats here

::preview{url=https://www.nyrb.com/products/on-cats}`,
			},
			{
				authorId: kody.id,
				publishAt: addDays(new Date(), -2).toISOString(),
				slug: 'hipster-cat',
				title: 'Hipster cat is pensive',
				description: 'What even is life, man?',
				content: `---
title: Hipster cat is pensive
slug: hipster-cat
description: What even is life, man?
published: ${format(addDays(new Date(), -2).toISOString(), 'yyyy-MM-dd')}
---

***


## Here's the hippest cat in the world 
![${hipsterCatImage.altText}](/resources/post-images/${hipsterCatImage.id} "${hipsterCatImage.title}")

Hipster cat has a cool exterior, but he just wants to be loved. 

### Here's another hipster cat who's grouchy:

::youtube{#M_35puAKcKc}`,
			},
		],
	})

	console.timeEnd('📝 Creating posts...')

	console.timeEnd(`🌱 Database has been seeded`)
}

seed()
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})

// we're ok to import from the test directory in this file
/*
eslint
	no-restricted-imports: "off",
*/
