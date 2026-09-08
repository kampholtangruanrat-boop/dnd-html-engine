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
                attacks:[]
            }
        ],
        encounterEnemies:[
            {
                id:"goblin_1",
                name:"Goblin 1",
                faction:"enemy",
                hp:7,
                ac:15
            }
        ]
    }
};

context.getAllCombatants = function(){
    return context.gameState.party.concat(context.gameState.encounterEnemies || []);
};

vm.createContext(context);
vm.runInContext(fs.readFileSync("js/combat_ui.js","utf8"),context);

const actor = context.getCurrentPlayerCharacter();
assert(actor,"Current player actor should be available");
assert.strictEqual(actor.id,"kenji","Current turn actor should be Kenji");

const targets = context.getHostileTargets(actor);
assert.strictEqual(targets.length,1,"Encounter fixture should expose one hostile target");
assert.strictEqual(targets[0].id,"goblin_1","Hostile target should be Goblin 1");

console.log("Combat UI tests: PASS");
