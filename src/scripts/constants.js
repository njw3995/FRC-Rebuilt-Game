export const BOT_MODELS = {
    turret: {
        accel: 0.38,
        rotSpeed: 0.05,
        capacity: 105,
        fireRate: 70,
        w: 35,
        h: 35
    },

    'Miss Daisy': {
        accel: 0.38,
        rotSpeed: 0.05,
        capacity: 8,
        fireRate: 85,
        w: 35,
        h: 35
    },

    'double turret': {
        accel: 0.38,
        rotSpeed: 0.05,
        capacity: 60,
        fireRate: 60,
        w: 35,
        h: 35
    },

    dumper: {
        accel: 0.38,
        rotSpeed: 0.045,
        capacity: 110,
        fireRate: 0,
        w: 35,
        h: 35
    },

    Blitz: {
        accel: 0.38,
        rotSpeed: 0.05,
        capacity: 15,
        fireRate: 0,
        w: 35,
        h: 35
    }
};

export const S = 1.6;
export const FIELD_W = 651.22 * S;
export const FIELD_H = 317.69 * S;
export const WALL_VISUAL = 105;
export const BALL_R = (5.91 * S) / 2;
export const HUB_S = 47 * S;
export const BUMP_W = 44.4 * S;
export const BUMP_L = 73 * S;
export const BAR_L = 12 * S;
export const TRENCH_L = 49.86 * S;
export const RED_SHOOT_LIMIT = (156.61 * S) + (BUMP_W / 2);
export const BLUE_SHOOT_LIMIT = FIELD_W - (156.61 * S) - (BUMP_W / 2);

export const STARTING_FUEL = 8;

export const TOWER_OFFSET = 144 * S;
export const TOWER_DIM = 45 * S;
export const TOWER_WALL_DEPTH = 6 * S;

export const DEPOT_W = 24 * S;
export const DEPOT_H = 42 * S;

export const OUTPOST_W = 58 * S;
export const OUTPOST_H = 72 * S;
export const OUTPOST_STARTING_FUEL = 24;
export const OUTPOST_MAX_FUEL = 48;
export const OUTPOST_FEEDER_MAX_FUEL = 24;
export const OUTPOST_ROBOT_FEED_RATE = 18;
export const OUTPOST_FEEDER_REFILL_RATE = 8;
export const OUTPOST_HUMAN_PLAYERS = 3;
export const OUTPOST_HUMAN_MIN_RATE = 0.5;
export const OUTPOST_HUMAN_MAX_RATE = 1.5;
export const OUTPOST_HUMAN_SHOOT_STOP_LEAD_TIME = 2;
export const NEUTRAL_FUEL_COLUMNS = 14;
export const NEUTRAL_FUEL_ROWS = 28;
export const DEPOT_FUEL_COLUMNS = 4;
export const DEPOT_FUEL_ROWS = 6;

export const MATCH_PHASES = [
    { name: 'AUTO',             start: 0,   end: 20,  redActive: true,  blueActive: true  },
    { name: 'DELAY',            start: 20,  end: 23,  redActive: false, blueActive: false },
    { name: 'TRANSITION SHIFT', start: 23,  end: 33,  redActive: true,  blueActive: true  },
    { name: 'SHIFT 1',          start: 33,  end: 58,  redActive: null,  blueActive: null  },
    { name: 'SHIFT 2',          start: 58,  end: 83,  redActive: null,  blueActive: null  },
    { name: 'SHIFT 3',          start: 83,  end: 108, redActive: null,  blueActive: null  },
    { name: 'SHIFT 4',          start: 108, end: 133, redActive: null,  blueActive: null  },
    { name: 'END GAME',         start: 133, end: 163, redActive: true,  blueActive: true  }
];

export const SHIFT_STATES = {
    red: [
        { redActive: false, blueActive: true  },
        { redActive: true,  blueActive: false },
        { redActive: false, blueActive: true  },
        { redActive: true,  blueActive: false }
    ],

    blue: [
        { redActive: true,  blueActive: false },
        { redActive: false, blueActive: true  },
        { redActive: true,  blueActive: false },
        { redActive: false, blueActive: true  }
    ]
};

export const START_LABELS = ['HUB', 'TOP TRENCH', 'BOT TRENCH'];

export const KEYBOARD_LAYOUTS = {
    p1: {
        up: ['KeyW'],
        down: ['KeyS'],
        left: ['KeyA'],
        right: ['KeyD'],
        turnLeft: ['KeyE'],
        turnRight: ['KeyR'],
        action: ['Space'],
        toggle: ['KeyF']
    },

    p2: {
        up: ['ArrowUp'],
        down: ['ArrowDown'],
        left: ['ArrowLeft'],
        right: ['ArrowRight'],
        turnLeft: ['Period', 'Numpad4'],
        turnRight: ['Slash', 'Numpad6'],
        action: ['ControlRight'],
        toggle: ['ShiftRight']
    }
};

export const OUTPOST_TOGGLE_KEYS = {
    red: 'KeyQ',
    blue: 'AltRight'
};

export const OUTPOST_CONTROLLER_TOGGLE_BUTTON = 3;

export const BLOCKED_KEYS = [
    'Space',
    'ControlRight',
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyQ',
    'KeyE',
    'KeyR',
    'KeyF',
    'AltRight',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Period',
    'Slash',
    'Numpad4',
    'Numpad6',
    'ShiftRight'
];

export const FRAME_RATE = 60;
