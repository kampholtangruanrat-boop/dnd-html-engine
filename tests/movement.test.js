const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync(
    "js/movement.js",
    "utf8"
);

const context = {};
vm.runInNewContext(source, context);

const map = {
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

const medium = character("medium", "Medium", 2, 2);
const large = character("large", "Large", 2, 2);

assert.strictEqual(
    context.getCreatureFootprint(large).squares.length,
    4
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

assert.strictEqual(
    context.getMovementCost(medium, 4, 2, map, [medium]),
    15
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

console.log("Movement footprint/corner tests: PASS");
