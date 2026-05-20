export const state = {
    matchRunning: false,
    startCountdown: 0,
    countdownInterval: null,
    matchElapsed: 0,
    endCooldown: 0,

    autoPhaseEnded: false,
    autoWinner: 'red',
    autoScoreRed: 0,
    autoScoreBlue: 0,
    hubRedActive: true,
    hubBlueActive: true,
    currentPhaseIdx: -1,

    sameTeamMode: false,
    p2Enabled: true,
    p1Input: 'keyboard',
    p2Input: 'keyboard',
    p1StartIdx: 0,
    p2StartIdx: 0,
    p1UnstickUsed: false,
    p2UnstickUsed: false,
    p1FreezeUntil: 0,
    p2FreezeUntil: 0,

    botRed: null,
    botBlue: null,

    balls: [],
    projectiles: [],
    scoringBalls: [],
    obstacles: [],
    zones: [],

    scoreRed: 0,
    scoreBlue: 0,
    keys: {},

    gamepadAssignments: {
        p1: null,
        p2: null
    }
};
