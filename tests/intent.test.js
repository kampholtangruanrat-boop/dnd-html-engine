const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/intent.js","utf8");
const context = {};
vm.createContext(context);
vm.runInContext(source,context);

const {
    createIntent,
    validateIntent,
    createConfirmationRequest,
    setPendingConfirmation,
    confirmPendingIntent,
    rejectPendingIntent
} = context;

function assert(condition,message){
    if(!condition){
        throw new Error(message);
    }
}

let created = createIntent({
    intentId:"intent-001",
    actorId:"kenji",
    type:"action",
    payload:{action:"attack",targetId:"goblin_01"},
    source:"player",
    rawText:"ผมโจมตี Goblin"
});

assert(created.success,"Valid player intent should be created");
assert(created.intent.status === "pending","New intent must start pending");
assert(created.intent.actorId === "kenji","Intent actor must be preserved");

let invalid = validateIntent({
    intentId:"bad-001",
    actorId:"kenji",
    type:"teleport",
    payload:{},
    source:"player",
    status:"pending"
});
assert(invalid.valid === false,"Unsupported intent type must be rejected");

invalid = validateIntent({
    intentId:"bad-002",
    actorId:"kenji",
    type:"move",
    payload:[],
    source:"player",
    status:"pending"
});
assert(invalid.valid === false,"Intent payload must be an object");

invalid = validateIntent({
    intentId:"bad-003",
    actorId:"kenji",
    type:"move",
    payload:{destination:{x:3,y:2}},
    source:"python_rng",
    status:"pending"
});
assert(invalid.valid === false,"Intent source must be player or ai_dm");

let confirmation = createConfirmationRequest({
    confirmationId:"confirm-001",
    intent:created.intent,
    question:"Which Goblin do you mean?",
    choices:["goblin_01","goblin_02"]
});
assert(confirmation.success,"Confirmation request should be created");

let state = {
    pendingConfirmation:null,
    hp:14,
    position:{x:2,y:2}
};

let result = setPendingConfirmation(state,confirmation.confirmation);
assert(result.success,"Pending confirmation should be stored");
assert(state.pendingConfirmation.confirmationId === "confirm-001","Confirmation must be stored by ID");
assert(state.hp === 14 && state.position.x === 2,"Confirmation must not change game state");

result = confirmPendingIntent(state,"wrong-id","goblin_01");
assert(result.success === false,"Unknown confirmation ID must be rejected");
assert(state.pendingConfirmation !== null,"Failed confirmation must remain pending");

result = confirmPendingIntent(state,"confirm-001","not-a-choice");
assert(result.success === false,"Invalid confirmation choice must be rejected");
assert(state.pendingConfirmation !== null,"Invalid choice must leave confirmation pending");

result = confirmPendingIntent(state,"confirm-001","goblin_02");
assert(result.success,"Valid confirmation should resolve the pending intent");
assert(result.intent.status === "confirmed","Confirmed intent must be marked confirmed");
assert(result.intent.confirmationSelection === "goblin_02","Confirmation selection must be preserved");
assert(state.pendingConfirmation === null,"Resolved confirmation must be cleared");
assert(state.hp === 14 && state.position.x === 2,"Confirming an intent must not resolve game state");

confirmation = createConfirmationRequest({
    confirmationId:"confirm-002",
    intent:created.intent,
    question:"Confirm this action?"
});
assert(confirmation.success,"Confirmation without choices should be supported");

setPendingConfirmation(state,confirmation.confirmation);
result = rejectPendingIntent(state,"confirm-002");
assert(result.success,"Pending intent should be rejectable");
assert(result.intent.status === "rejected","Rejected intent must be marked rejected");
assert(state.pendingConfirmation === null,"Rejected confirmation must be cleared");

console.log("Intent protocol tests: PASS");
