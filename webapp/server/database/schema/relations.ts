import { relations } from 'drizzle-orm'
import {
  editionContributors,
  editionIdentifiers,
  editionWorks,
  editions,
  persons,
  publishers,
  workContributors,
  works,
} from './catalog'
import { collections, copies, copyPhotos, locations } from './collections'
import { bookMarks, reviews } from './diary'
import { listItems, lists } from './lists'
import { loans } from './loans'
import { copyUserTags, userTags, workUserTags } from './tags'
import { contacts, users } from './users'

/**
 * Связи для db.query.* — на DDL не влияют, миграции их не видят.
 * Описаны только те, по которым реально ходят экраны приложения.
 */

export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts),
  collections: many(collections),
  lists: many(lists),
  tags: many(userTags),
  bookMarks: many(bookMarks),
  reviews: many(reviews),
}))

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  owner: one(users, { fields: [contacts.ownerId], references: [users.id], relationName: 'contactOwner' }),
  linkedUser: one(users, { fields: [contacts.linkedUserId], references: [users.id], relationName: 'contactLinkedUser' }),
  loans: many(loans),
}))

export const worksRelations = relations(works, ({ many }) => ({
  contributors: many(workContributors),
  editionLinks: many(editionWorks),
  tagLinks: many(workUserTags),
  bookMarks: many(bookMarks),
  reviews: many(reviews),
}))

export const workContributorsRelations = relations(workContributors, ({ one }) => ({
  work: one(works, { fields: [workContributors.workId], references: [works.id] }),
  person: one(persons, { fields: [workContributors.personId], references: [persons.id] }),
}))

export const personsRelations = relations(persons, ({ many }) => ({
  workRoles: many(workContributors),
  editionRoles: many(editionContributors),
}))

export const publishersRelations = relations(publishers, ({ many }) => ({
  editions: many(editions),
}))

export const editionsRelations = relations(editions, ({ one, many }) => ({
  publisher: one(publishers, { fields: [editions.publisherId], references: [publishers.id] }),
  identifiers: many(editionIdentifiers),
  workLinks: many(editionWorks),
  contributors: many(editionContributors),
  copies: many(copies),
}))

export const editionIdentifiersRelations = relations(editionIdentifiers, ({ one }) => ({
  edition: one(editions, { fields: [editionIdentifiers.editionId], references: [editions.id] }),
}))

export const editionWorksRelations = relations(editionWorks, ({ one }) => ({
  edition: one(editions, { fields: [editionWorks.editionId], references: [editions.id] }),
  work: one(works, { fields: [editionWorks.workId], references: [works.id] }),
}))

export const editionContributorsRelations = relations(editionContributors, ({ one }) => ({
  edition: one(editions, { fields: [editionContributors.editionId], references: [editions.id] }),
  person: one(persons, { fields: [editionContributors.personId], references: [persons.id] }),
  work: one(works, { fields: [editionContributors.workId], references: [works.id] }),
}))

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  owner: one(users, { fields: [collections.ownerId], references: [users.id] }),
  locations: many(locations),
  copies: many(copies),
}))

export const locationsRelations = relations(locations, ({ one, many }) => ({
  collection: one(collections, { fields: [locations.collectionId], references: [collections.id] }),
  copies: many(copies),
}))

export const copiesRelations = relations(copies, ({ one, many }) => ({
  edition: one(editions, { fields: [copies.editionId], references: [editions.id] }),
  collection: one(collections, { fields: [copies.collectionId], references: [collections.id] }),
  location: one(locations, { fields: [copies.locationId], references: [locations.id] }),
  photos: many(copyPhotos),
  loans: many(loans),
  tagLinks: many(copyUserTags),
}))

export const copyPhotosRelations = relations(copyPhotos, ({ one }) => ({
  copy: one(copies, { fields: [copyPhotos.copyId], references: [copies.id] }),
}))

export const loansRelations = relations(loans, ({ one }) => ({
  copy: one(copies, { fields: [loans.copyId], references: [copies.id] }),
  borrowerUser: one(users, { fields: [loans.borrowerUserId], references: [users.id] }),
  borrowerContact: one(contacts, { fields: [loans.borrowerContactId], references: [contacts.id] }),
}))

export const userTagsRelations = relations(userTags, ({ one, many }) => ({
  owner: one(users, { fields: [userTags.ownerId], references: [users.id] }),
  workLinks: many(workUserTags),
  copyLinks: many(copyUserTags),
}))

export const workUserTagsRelations = relations(workUserTags, ({ one }) => ({
  tag: one(userTags, { fields: [workUserTags.tagId], references: [userTags.id] }),
  work: one(works, { fields: [workUserTags.workId], references: [works.id] }),
}))

export const copyUserTagsRelations = relations(copyUserTags, ({ one }) => ({
  tag: one(userTags, { fields: [copyUserTags.tagId], references: [userTags.id] }),
  copy: one(copies, { fields: [copyUserTags.copyId], references: [copies.id] }),
}))

export const listsRelations = relations(lists, ({ one, many }) => ({
  owner: one(users, { fields: [lists.ownerId], references: [users.id] }),
  items: many(listItems),
}))

export const listItemsRelations = relations(listItems, ({ one }) => ({
  list: one(lists, { fields: [listItems.listId], references: [lists.id] }),
  work: one(works, { fields: [listItems.workId], references: [works.id] }),
  edition: one(editions, { fields: [listItems.editionId], references: [editions.id] }),
}))

export const bookMarksRelations = relations(bookMarks, ({ one }) => ({
  user: one(users, { fields: [bookMarks.userId], references: [users.id] }),
  work: one(works, { fields: [bookMarks.workId], references: [works.id] }),
  edition: one(editions, { fields: [bookMarks.editionId], references: [editions.id] }),
}))

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  work: one(works, { fields: [reviews.workId], references: [works.id] }),
  edition: one(editions, { fields: [reviews.editionId], references: [editions.id] }),
}))
