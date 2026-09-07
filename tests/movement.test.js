const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync(
    "js/movement.js",
    "utf8"
);

const context = {};
vm.runInNewContext(source, context);

const baseMap = {
    width: 8,
    height: 8,
    rules: {
        feetPerSquare: 5,
        diagonalMovement: "standard"
    },
    tiles: []
};

function character(id, size, x, y, faction = "player") {
    return {
        id,
        size,
        faction,
        conditions: [],
        position: { x, y },
        movement: {
            remaining: 30,
            spent: 0,
            types: { walk: 30, climb: 0, swim: 0, fly: 0 }
        }
    };
}

function assertValidPath(path, start, target) {
    let previous = start;

    for (const step of path) {
        assert.ok(
            Math.abs(step.x - previous.x) <= 1 &&
            Math.abs(step.y - previous.y) <= 1 &&
            (step.x !== previous.x || step.y !== previous.y),
            `Invalid step from ${previous.x},${previous.y} to ${step.x},${step.y}`
        );
        previous = step;
    }

    assert.strictEqual(previous.x, target.x);
    assert.strictEqual(previous.y, target.y);
}

const map = JSON.parse(JSON.stringify(baseMap));
const medium = character("medium", "Medium", 2, 2);
const large = character("large", "Large", 2, 2);

assert.strictEqual(
    context.getCreatureFootprint(large).squares.length,
    4
);

const directPath =
    context.getMovementPath(medium, 4, 2, map, [medium]);

assertValidPath(
    directPath,
    medium.position,
    { x: 4, y: 2 }
);

assert.strictEqual(
    context.getMovementCost(medium, 4, 2, map, [medium]),
    10
);

assert.strictEqual(
    context.getMovementCost(large, 3, 2, map, [large]),
    5
);

map.tiles.push({
    x: 3,
    y: 2,
    terrain: "mud",
    difficult: true
});

const mudPath =
    context.getMovementPath(medium, 4, 2, map, [medium]);

assertValidPath(
    mudPath,
    medium.position,
    { x: 4, y: 2 }
);

assert.strictEqual(
    context.getMovementCost(medium, 4, 2, map, [medium]),
    10
);

assert.ok(
    mudPath.some(step => step.x !== 3 || step.y !== 2),
    "Path should avoid the costly mud square when possible"
);

const enemy = character("enemy", "Medium", 3, 2, "enemy");

assert.strictEqual(
    context.canMoveTo(medium, 4, 2, map, [medium, enemy]).allowed,
    false
);

const ally = character("ally", "Medium", 3, 2, "player");

assert.strictEqual(
    context.canMoveTo(medium, 4, 2, map, [medium, ally]).allowed,
    true
);

assert.strictEqual(
    context.canMoveTo(medium, 3, 2, map, [medium, ally]).allowed,
    false
);

const wallMap = {
    width: 6,
    height: 6,
    rules: {
        feetPerSquare: 5,
        diagonalMovement: "standard"
    },
    tiles: [
        { x: 3, y: 2, blocksMovement: true },
        { x: 3, y: 3, blocksMovement: true },
        { x: 3, y: 4, blocksMovement: true }
    ]
};

const pathCharacter =
    character("path", "Medium", 2, 3);

const detourPath =
    context.getMovementPath(
        pathCharacter,
        4,
        3,
        wallMap,
        [pathCharacter]
    );

assertValidPath(
    detourPath,
    pathCharacter.position,
    { x: 4, y: 3 }
);

assert.ok(detourPath.length > 2);

for(const step of detourPath){
    assert.strictEqual(
        wallMap.tiles.some(tile => tile.x === step.x && tile.y === step.y),
        false,
        "Path entered blocked square"
    );
}

assert.strictEqual(
    context.getMovementCost(
        pathCharacter,
        4,
        3,
        wallMap,
        [pathCharacter]
    ),
    detourPath.length * 5
);

const cornerMap = {
    width: 5,
    height: 5,
    rules: {
        feetPerSquare: 5,
        diagonalMovement: "standard"
    },
    tiles: [
        { x: 3, y: 2, fillsSpace: true }
    ]
};

assert.strictEqual(
    context.canMoveTo(
        character("corner", "Medium", 2, 2),
        3,
        3,
        cornerMap,
        []
    ).allowed,
    false
);

assert.strictEqual(
    context.canMoveTo(
        character("edge", "Large", 1, 1),
        2,
        2,
        map,
        []
    ).allowed,
    true
);

assert.strictEqual(
    context.canMoveTo(
        character("outside", "Large", 7, 7),
        8,
        8,
        map,
        []
    ).allowed,
    false
);

console.log("Movement pathfinding tests: PASS");
