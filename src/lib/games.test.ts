import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

/**
 * Seeds categories, publishers, and games for filter-helper tests.
 *
 * @param db - The in-memory database to seed.
 * @returns The IDs needed to construct filter queries.
 */
async function seedFilteredGames(db: Database): Promise<{ strategyId: number; puzzleId: number; alphaId: number; betaId: number }> {
    const [strategyCategory] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzleCategory] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [alphaPublisher] = await db
        .insert(publishers)
        .values({ name: 'Alpha Studio', description: 'pub' })
        .returning({ id: publishers.id });
    const [betaPublisher] = await db
        .insert(publishers)
        .values({ name: 'Beta Studio', description: 'pub' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        { title: 'Apex Tactics', description: 'Alpha strategy', starRating: 4.5, categoryId: strategyCategory.id, publisherId: alphaPublisher.id },
        { title: 'Brain Bender', description: 'Beta puzzle', starRating: 3.8, categoryId: puzzleCategory.id, publisherId: betaPublisher.id },
        { title: 'Castle Logic', description: 'Alpha strategy', starRating: 4.2, categoryId: strategyCategory.id, publisherId: alphaPublisher.id },
        { title: 'Deeper Dilemma', description: 'Beta puzzle', starRating: 4.0, categoryId: puzzleCategory.id, publisherId: betaPublisher.id },
    ]);

    return {
        strategyId: strategyCategory.id,
        puzzleId: puzzleCategory.id,
        alphaId: alphaPublisher.id,
        betaId: betaPublisher.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('filters games by category and publisher together', async () => {
        const filters = await seedFilteredGames(db);

        const byCategory = await getAllGames(db, { categoryIds: [filters.strategyId] });
        expect(byCategory.map((game) => game.title)).toEqual(['Apex Tactics', 'Castle Logic']);

        const byCombinedFilters = await getAllGames(db, {
            categoryIds: [filters.strategyId],
            publisherIds: [filters.alphaId],
        });

        expect(byCombinedFilters.map((game) => game.title)).toEqual(['Apex Tactics', 'Castle Logic']);
        expect(byCombinedFilters.every((game) => game.category?.name === 'Strategy' && game.publisher?.name === 'Alpha Studio')).toBe(true);
    });

    it('returns an empty list when filters match no games', async () => {
        await seedFilteredGames(db);

        const gamesByFilters = await getAllGames(db, {
            categoryIds: [999],
            publisherIds: [999],
        });

        expect(gamesByFilters).toEqual([]);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
