import { asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

/** Optional catalog constraints for category and publisher IDs. */
export interface GameFilters {
    categoryIds?: number[];
    publisherIds?: number[];
}

/** Fields selected from the games table and its category and publisher relations. */
const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

/** Row shape selected from the games table and its category and publisher relations. */
type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

/** Converts a selected database row into the application-facing game model. */
function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

/** Starts a game query with category and publisher relations included. */
function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** Drizzle query shape needed by the game-filter helper. */
type FilterableQuery<T> = T & {
    where: (condition: ReturnType<typeof inArray>) => T;
};

/**
 * Applies optional category and publisher filters to a query.
 *
 * @param query - The Drizzle query to constrain.
 * @param filters - Category and publisher IDs to include.
 * @returns The query with the requested filters applied.
 */
function applyGameFilters<T>(query: T, filters: GameFilters = {}): T {
    const categoryIds = filters.categoryIds ?? [];
    const publisherIds = filters.publisherIds ?? [];
    let filterableQuery = query as FilterableQuery<T>;

    if (categoryIds.length > 0) {
        filterableQuery = filterableQuery.where(inArray(games.categoryId, categoryIds)) as FilterableQuery<T>;
    }

    if (publisherIds.length > 0) {
        filterableQuery = filterableQuery.where(inArray(games.publisherId, publisherIds)) as FilterableQuery<T>;
    }

    return filterableQuery;
}

/**
 * Returns all categories ordered alphabetically by name.
 *
 * @param db - The database connection to query.
 * @returns The categories available to filter games.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/**
 * Returns all publishers ordered alphabetically by name.
 *
 * @param db - The database connection to query.
 * @returns The publishers available to filter games.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/**
 * Returns games ordered by title, optionally filtered by category and publisher.
 *
 * @param db - The database connection to query.
 * @param filters - Optional category and publisher IDs to include.
 * @returns Matching games with their category and publisher relations.
 */
export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const rows: GameSelectionRow[] = await applyGameFilters(baseGamesQuery(db), filters).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Returns game IDs ordered by title, optionally filtered by category and publisher.
 *
 * @param db - The database connection to query.
 * @param filters - Optional category and publisher IDs to include.
 * @returns The matching game IDs.
 */
export async function getAllGameIds(db: Database, filters: GameFilters = {}): Promise<number[]> {
    const rows: Array<{ id: number }> = await applyGameFilters(db.select({ id: games.id }).from(games), filters).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Returns one game by ID, or `null` when it does not exist.
 *
 * @param db - The database connection to query.
 * @param id - The game ID to find.
 * @returns The matching game, or `null`.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
