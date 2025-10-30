import Database from 'better-sqlite3'

const DEFAULT_CACHE_PATH = '/dev/shm/cache.sqlite'

const CACHE_DB_PATH =
	process.env.CACHE_DATABASE_PATH ??
	process.env.CACHE_DB_PATH ??
	DEFAULT_CACHE_PATH

export const getCacheDbPath = () => CACHE_DB_PATH

export function openReadOnly() {
	return new Database(CACHE_DB_PATH, { readonly: true, fileMustExist: true })
}

export function openReadWrite() {
	const db = new Database(CACHE_DB_PATH)
	db.pragma('journal_mode = WAL')
	db.pragma('synchronous = NORMAL')
	return db
}
