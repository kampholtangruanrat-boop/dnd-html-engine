function getAbilityModifier(score){

    return Math.floor((score - 10) / 2);
}


function rollInitiative(character,rng = Math.random){

    const roll =
        Math.floor(rng() * 20) + 1;

    const dexModifier =
        getAbilityModifier(character.abilities.dex);

    return {
        roll: roll,
        modifier: dexModifier,
        total: roll + dexModifier
    };
}


function resetTurnResources(character){

    if(!character || !character.movement){

        return {
            success:false
        };

    }

    character.movement.remaining =
        character.movement.types.walk;

    character.movement.spent = 0;

    character.turnResources = {
        actionUsed:false,
        bonusActionUsed:false,
        reactionUsed:false
    };

    return {
        success:true
    };
}


function initializeCombat(characters,rng = Math.random){

    if(!characters || characters.length === 0){

        return {
            success:false,
            state:null
        };
    }

    const initiative =
        characters.map((character,index) => {

            const result =
                rollInitiative(character,rng);

            return {
                characterId:character.id,
                roll:result.roll,
                modifier:result.modifier,
                total:result.total,
                order:index
            };
        });

    initiative.sort((a,b) => {

        if(b.total !== a.total){
            return b.total - a.total;
        }

        return a.order - b.order;
    });

    const state = {
        active:true,
        round:1,
        turnIndex:0,
        initiative:initiative
    };

    const result =
        beginTurn(state,characters);

    if(!result.success){
        return {
            success:false,
            state:null
        };
    }

    return {
        success:true,
        state:state
    };
}


function beginTurn(state,characters){

    if(!state.active || !state.initiative.length){
        return {
            success:false,
            character:null
        };
    }

    const entry =
        state.initiative[state.turnIndex];

    const character =
        characters.find(c => c.id === entry.characterId);

    if(!character){
        return {
            success:false,
            character:null
        };
    }

    resetTurnResources(character);

    return {
        success:true,
        character:character
    };
}


function advanceTurn(state,characters){

    if(!state.active || !state.initiative.length){
        return {
            success:false,
            state:state,
            previousCharacterId:null
        };
    }

    const currentEntry =
        state.initiative[state.turnIndex];

    const previousCharacterId =
        currentEntry.characterId;

    state.turnIndex += 1;

    if(state.turnIndex >= state.initiative.length){

        state.turnIndex = 0;
        state.round += 1;
    }

    const result =
        beginTurn(state,characters);

    if(!result.success){
        return {
            success:false,
            state:state,
            previousCharacterId:previousCharacterId
        };
    }

    return {
        success:true,
        state:state,
        previousCharacterId:previousCharacterId,
        character:result.character
    };
}


function getCurrentTurnCharacter(state,characters){

    if(!state || !state.active || !state.initiative.length){
        return null;
    }

    const entry =
        state.initiative[state.turnIndex];

    return characters.find(c => c.id === entry.characterId) || null;
}


function useAction(character){

    if(!character){
        return false;
    }

    if(!character.turnResources){
        resetTurnResources(character);
    }

    if(character.turnResources.actionUsed){
        return false;
    }

    character.turnResources.actionUsed = true;
    return true;
}


function useBonusAction(character){

    if(!character){
        return false;
    }

    if(!character.turnResources){
        resetTurnResources(character);
    }

    if(character.turnResources.bonusActionUsed){
        return false;
    }

    character.turnResources.bonusActionUsed = true;
    return true;
}


function useReaction(character){

    if(!character){
        return false;
    }

    if(!character.turnResources){
        resetTurnResources(character);
    }

    if(character.turnResources.reactionUsed){
        return false;
    }

    character.turnResources.reactionUsed = true;
    return true;
}
