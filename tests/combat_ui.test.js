const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {
    gameState: {
        turn: {
            active:true,
            phase:"turn",
            initiative:[
                {characterId:"kenji",total:15,order:0},
                {characterId:"mira",total:10,order:1}
            ],
            turnIndex:0,
            combatId:"ui-test"
        },
        party:[
            {
                id:"kenji",
                faction:"player",
                turnResources:{actionUsed:false},
                attacks:[{
                    name:"Longsword",
                    actionId:"attack-longsword",
                    attackMode:"melee",
                    reachFeet:5,
                    attackBonus:5,
                    damageDice:{count:1,sides:8},
                    damageBonus:3,
                    damageType:"slashing"
                }]
            },
            {
                id:"mira",
                faction:"player",
                turnResources:{actionUsed:false},
                attacks:[{
                    name:"Longbow",
                    actionId:"mira-longbow",
                    attackMode:"ranged",
                    normalRangeFeet:150,
                    longRangeFeet:600,
                    attackBonus:5,
                    damageDice:{count:1,sides:8},
                    damageBonus:3,
                    damageType:"piercing"
                }]
            }
        ],
        encounterEnemies:[
            {
                id:"goblin_1",
                name:"Goblin 1",
                faction:"enemy",
                hp:7,
                ac:15,
                position:{x:2,y:3}
            },
            {
                id:"goblin_2",
                name:"Goblin 2",
                faction:"enemy",
                hp:7,
                ac:15,
                position:{x:5,y:3}
            }
        ]
    }
};

context.getAllCombatants = function(){
    return context.gameState.party.concat(context.gameState.encounterEnemies || []);
};
context.renderMap = function(){};
context.renderCombatActions = function(){};

vm.createContext(context);
vm.runInContext(fs.readFileSync("js/combat_ui.js","utf8"),context);

const actor = context.getCurrentPlayerCharacter();
assert(actor,"Current player actor should be available");
assert.strictEqual(actor.id,"kenji","Current turn actor should be Kenji");

const targets = context.getHostileTargets(actor);
assert.strictEqual(targets.length,2,"Encounter fixture should expose both hostile targets");
assert.strictEqual(targets[0].id,"goblin_1","First hostile target should be Goblin 1");
assert.strictEqual(targets[1].id,"goblin_2","Second hostile target should be Goblin 2");

context.selectCombatTarget("goblin_2");
assert.strictEqual(context.gameState.selectedTargetId,"goblin_2","Clicking an enemy token should select it as the attack target");

assert.deepStrictEqual(
    context.parseRollResultsInput("15,7"),
    [15,7],
    "Comma-separated advantage results should parse as two dice"
);
assert.deepStrictEqual(
    context.parseRollResultsInput("8 11"),
    [8,11],
    "Whitespace-separated advantage results should parse as two dice"
);
assert.deepStrictEqual(
    context.parseRollResultsInput("12"),
    [12],
    "A single normal-roll result should parse as one die"
);

console.log("Combat UI tests: PASS");
