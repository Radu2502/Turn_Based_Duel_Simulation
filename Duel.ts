// index.ts

import { parseArgs } from "node:util";

type PlayerName = "C1" | "C2";
type DuelResult = PlayerName | "Draw";
type AbilityMode = "fixed" | "per-round";

type Character = {
    name: PlayerName;
    health: number;
    attack: number;
    defense: number;
    ability: Ability;
};

type DuelOptions = {
    maxRounds: number;
    abilityMode: AbilityMode;
    verbose: boolean;
};

type DuelSummary = {
    winner: DuelResult;
    rounds: number;
};

type RoundContext = {
    attacker: Character;
    defender: Character;
    attackPower: number;
    damage: number;
    messages: string[];
};

type Ability = {
    name: string;
    onAttack?: (round: RoundContext) => void;
    onDefense?: (round: RoundContext) => void;
    afterDamage?: (round: RoundContext) => void;
};

const CONFIG = {
    CHARACTER: {
        MAX_HEALTH: 100,
        ATTACK_MIN: 15,
        ATTACK_MAX: 20,
        DEFENSE_MIN: 10,
        DEFENSE_MAX: 15,
    },

    COMBAT: {
        MIN_DAMAGE: 1,
        SAFETY_ROUND_LIMIT: 100,
    },

    ABILITIES: {
        ACTIVATION_CHANCE: 0.25,
        POWER_STRIKE_MULTIPLIER: 1.5,
        DAMAGE_REDUCTION_MULTIPLIER: 0.5,
        SECOND_WIND_THRESHOLD: 30,
        SECOND_WIND_HEAL: 5,
    },

    SIMULATION: {
        DEFAULT_COUNT: 1000,
    },
} as const;

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(probability: number): boolean {
    return Math.random() < probability;
}

function calculateRawDamage(attackPower: number, defense: number): number {
    return Math.max(0, attackPower - defense);
}

function toDamagePoints(value: number): number {
    return Math.max(CONFIG.COMBAT.MIN_DAMAGE, Math.round(value));
}

function clampHealth(health: number): number {
    return Math.max(0, Math.min(CONFIG.CHARACTER.MAX_HEALTH, health));
}

const ABILITIES: Ability[] = [
    {
        name: "Power Strike",

        onAttack(round: RoundContext): void {
            if (!chance(CONFIG.ABILITIES.ACTIVATION_CHANCE)) return;

            round.attackPower *= CONFIG.ABILITIES.POWER_STRIKE_MULTIPLIER;
            round.messages.push(`${round.attacker.name} activates Power Strike`);
        },
    },

    {
        name: "Damage Reduction",

        onDefense(round: RoundContext): void {
            if (!chance(CONFIG.ABILITIES.ACTIVATION_CHANCE)) return;

            round.damage *= CONFIG.ABILITIES.DAMAGE_REDUCTION_MULTIPLIER;
            round.messages.push(`${round.defender.name} activates Damage Reduction`);
        },
    },

    {
        name: "Second Wind",

        afterDamage(round: RoundContext): void {
            if (round.defender.health <= 0) return;
            if (round.defender.health >= CONFIG.ABILITIES.SECOND_WIND_THRESHOLD) return;
            if (!chance(CONFIG.ABILITIES.ACTIVATION_CHANCE)) return;

            round.defender.health = clampHealth(
                round.defender.health + CONFIG.ABILITIES.SECOND_WIND_HEAL
            );

            round.messages.push(`${round.defender.name} activates Second Wind`);
        },
    },
];

function randomAbility(): Ability {
    return ABILITIES[randomInt(0, ABILITIES.length - 1)]!;
}

function createCharacter(name: PlayerName): Character {
    return {
        name,
        health: CONFIG.CHARACTER.MAX_HEALTH,
        attack: randomInt(
            CONFIG.CHARACTER.ATTACK_MIN,
            CONFIG.CHARACTER.ATTACK_MAX
        ),
        defense: randomInt(
            CONFIG.CHARACTER.DEFENSE_MIN,
            CONFIG.CHARACTER.DEFENSE_MAX
        ),
        ability: randomAbility(),
    };
}

function executeRound(attacker: Character, defender: Character): RoundContext {
    const round: RoundContext = {
        attacker,
        defender,
        attackPower: attacker.attack,
        damage: 0,
        messages: [],
    };

    attacker.ability.onAttack?.(round);

    round.damage = calculateRawDamage(round.attackPower, defender.defense);

    defender.ability.onDefense?.(round);

    round.damage = toDamagePoints(round.damage);

    defender.health = clampHealth(defender.health - round.damage);

    defender.ability.afterDamage?.(round);

    if (round.messages.length === 0) {
        round.messages.push("No ability activated");
    }

    return round;
}

function updateAbilitiesForRound(
    c1: Character,
    c2: Character,
    abilityMode: AbilityMode
): void {
    if (abilityMode !== "per-round") return;

    c1.ability = randomAbility();
    c2.ability = randomAbility();
}

function printInitialState(
    c1: Character,
    c2: Character,
    abilityMode: AbilityMode
): void {
    console.log("Initial state:");

    console.log(
        `${c1.name}: attack = ${c1.attack}, defense = ${c1.defense}` +
        (abilityMode === "fixed" ? `, ability = ${c1.ability.name}` : "")
    );

    console.log(
        `${c2.name}: attack = ${c2.attack}, defense = ${c2.defense}` +
        (abilityMode === "fixed" ? `, ability = ${c2.ability.name}` : "")
    );

    if (abilityMode === "per-round") {
        console.log("Abilities are assigned randomly each round.");
    }

    console.log("");
}

function printRound(
    roundNumber: number,
    round: RoundContext,
    c1: Character,
    c2: Character,
    abilityMode: AbilityMode
): void {
    console.log(`Round ${roundNumber}:`);

    if (abilityMode === "per-round") {
        console.log(
            `Abilities this round: ${c1.name} = ${c1.ability.name}, ` +
            `${c2.name} = ${c2.ability.name}`
        );
    }

    console.log(`${round.attacker.name} attacks ${round.defender.name}`);

    for (const message of round.messages) {
        console.log(message);
    }

    console.log(`${round.defender.name} takes ${round.damage} damage`);
    console.log(`${c1.name} health = ${c1.health}, ${c2.name} health = ${c2.health}`);
    console.log("");
}

function printDuelResult(winner: DuelResult, rounds: number): void {
    if (winner === "Draw") {
        console.log(`Draw after ${rounds} rounds.`);
        return;
    }

    console.log(`${winner} won after ${rounds} rounds!`);
}

function simulateDuel(
    c1: Character,
    c2: Character,
    options: DuelOptions
): DuelSummary {
    let rounds = 0;

    let attacker: Character;
    let defender: Character;

    if (Math.random() < 0.5) {
        attacker = c1;
        defender = c2;
    } else {
        attacker = c2;
        defender = c1;
    }

    if (options.verbose) {
        printInitialState(c1, c2, options.abilityMode);
    }

    while (c1.health > 0 && c2.health > 0 && rounds < options.maxRounds) {
        rounds++;

        updateAbilitiesForRound(c1, c2, options.abilityMode);

        const round = executeRound(attacker, defender);

        if (options.verbose) {
            printRound(rounds, round, c1, c2, options.abilityMode);
        }

        const oldAttacker = attacker;
        attacker = defender;
        defender = oldAttacker;
    }

    let winner: DuelResult = "Draw";

    if (c1.health <= 0 && c2.health > 0) {
        winner = "C2";
    } else if (c2.health <= 0 && c1.health > 0) {
        winner = "C1";
    }

    if (options.verbose) {
        printDuelResult(winner, rounds);
    }

    return {
        winner,
        rounds,
    };
}

function runSimulations(
    count: number,
    abilityMode: AbilityMode,
    maxRounds: number
): void {
    const results: Record<DuelResult, number> = {
        C1: 0,
        C2: 0,
        Draw: 0,
    };

    let totalRounds = 0;

    for (let i = 0; i < count; i++) {
        const c1 = createCharacter("C1");
        const c2 = createCharacter("C2");

        const result = simulateDuel(c1, c2, {
            maxRounds,
            abilityMode,
            verbose: false,
        });

        results[result.winner]++;
        totalRounds += result.rounds;
    }

    console.log(`Results after ${count} duels`);
    console.log(`Ability mode: ${abilityMode}`);
    console.log(`Max rounds per duel: ${maxRounds}`);
    console.log("");

    console.log(
        `C1 wins: ${results.C1} (${((results.C1 / count) * 100).toFixed(1)}%)`
    );

    console.log(
        `C2 wins: ${results.C2} (${((results.C2 / count) * 100).toFixed(1)}%)`
    );

    console.log(
        `Draws: ${results.Draw} (${((results.Draw / count) * 100).toFixed(1)}%)`
    );

    console.log(`Average rounds: ${(totalRounds / count).toFixed(1)}`);
}

function parsePositiveInteger(value: unknown, flagName: string): number {
    const numberValue = Number(value);

    if (!Number.isInteger(numberValue) || numberValue <= 0) {
        throw new Error(`${flagName} must be a positive integer.`);
    }

    return numberValue;
}

function parseAbilityMode(value: unknown): AbilityMode {
    if (value === undefined) {
        return "fixed";
    }

    if (value === "fixed" || value === "per-round") {
        return value;
    }

    throw new Error("--ability-mode must be either fixed or per-round.");
}

function getCliOptions(): {
    abilityMode: AbilityMode;
    maxRounds: number;
    simulations?: number;
} {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            simulate: {
                type: "boolean",
                default: false,
            },
            simulations: {
                type: "string",
            },
            "ability-mode": {
                type: "string",
                default: "fixed",
            },
            "per-round": {
                type: "boolean",
                default: false,
            },
            "max-rounds": {
                type: "string",
                default: String(CONFIG.COMBAT.SAFETY_ROUND_LIMIT),
            },
        },
        strict: true,
    });

    let abilityMode = parseAbilityMode(values["ability-mode"]);

    if (values["per-round"]) {
        abilityMode = "per-round";
    }

    const maxRounds = parsePositiveInteger(values["max-rounds"], "--max-rounds");

    let simulations: number | undefined;

    if (values.simulations !== undefined) {
        simulations = parsePositiveInteger(values.simulations, "--simulations");
    } else if (values.simulate) {
        simulations = CONFIG.SIMULATION.DEFAULT_COUNT;
    }

    return {
        abilityMode,
        maxRounds,
        simulations,
    };
}

function main(): void {
    const options = getCliOptions();

    if (options.simulations !== undefined) {
        runSimulations(
            options.simulations,
            options.abilityMode,
            options.maxRounds
        );

        return;
    }

    const c1 = createCharacter("C1");
    const c2 = createCharacter("C2");

    simulateDuel(c1, c2, {
        maxRounds: options.maxRounds,
        abilityMode: options.abilityMode,
        verbose: true,
    });
}

main();