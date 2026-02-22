/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/stablecoin.json`.
 */
export type Stablecoin = {
  "address": "CEKm6ppyaCKcTczqALo6k3tpBSaLvhLEKqy7ao3vXdbV",
  "metadata": {
    "name": "stablecoin",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana Stablecoin Standard - SSS-1 & SSS-2"
  },
  "instructions": [
    {
      "name": "addToBlacklist",
      "docs": [
        "Add an address to the blacklist (SSS-2 only)"
      ],
      "discriminator": [
        90,
        115,
        98,
        231,
        173,
        119,
        117,
        176
      ],
      "accounts": [
        {
          "name": "blacklister",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_state.mint",
                "account": "stablecoinState"
              }
            ]
          }
        },
        {
          "name": "address"
        },
        {
          "name": "blacklistEntry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  108,
                  97,
                  99,
                  107,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinState"
              },
              {
                "kind": "account",
                "path": "address"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "burnTokens",
      "docs": [
        "Burn tokens from an account"
      ],
      "discriminator": [
        76,
        15,
        51,
        254,
        229,
        215,
        121,
        66
      ],
      "accounts": [
        {
          "name": "burner",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "burnFromAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "freezeAccount",
      "docs": [
        "Freeze a token account"
      ],
      "discriminator": [
        253,
        75,
        82,
        133,
        167,
        238,
        43,
        130
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize a new stablecoin with config (SSS-1 or SSS-2)"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "The Token-2022 mint - created before this instruction via system program",
            "We use UncheckedAccount as Token-2022 mints with extensions need special handling"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "initializeParams"
            }
          }
        }
      ]
    },
    {
      "name": "mintTokens",
      "docs": [
        "Mint tokens to a recipient"
      ],
      "discriminator": [
        59,
        132,
        24,
        246,
        122,
        39,
        8,
        243
      ],
      "accounts": [
        {
          "name": "minter",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "minterState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinState"
              },
              {
                "kind": "account",
                "path": "minter"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "recipientTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pause",
      "docs": [
        "Pause all minting and burning operations"
      ],
      "discriminator": [
        211,
        22,
        221,
        251,
        74,
        121,
        193,
        47
      ],
      "accounts": [
        {
          "name": "pauser",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_state.mint",
                "account": "stablecoinState"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "removeFromBlacklist",
      "docs": [
        "Remove an address from the blacklist (SSS-2 only)"
      ],
      "discriminator": [
        47,
        105,
        20,
        10,
        165,
        168,
        203,
        219
      ],
      "accounts": [
        {
          "name": "blacklister",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_state.mint",
                "account": "stablecoinState"
              }
            ]
          }
        },
        {
          "name": "address"
        },
        {
          "name": "blacklistEntry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  108,
                  97,
                  99,
                  107,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinState"
              },
              {
                "kind": "account",
                "path": "address"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "seize",
      "docs": [
        "Seize tokens from a blacklisted account via permanent delegate (SSS-2 only)"
      ],
      "discriminator": [
        129,
        159,
        143,
        31,
        161,
        224,
        241,
        84
      ],
      "accounts": [
        {
          "name": "seizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "targetAddress"
        },
        {
          "name": "blacklistEntry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  108,
                  97,
                  99,
                  107,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinState"
              },
              {
                "kind": "account",
                "path": "targetAddress"
              }
            ]
          }
        },
        {
          "name": "fromTokenAccount",
          "writable": true
        },
        {
          "name": "toTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "thawAccount",
      "docs": [
        "Thaw a frozen token account"
      ],
      "discriminator": [
        115,
        152,
        79,
        213,
        213,
        169,
        184,
        35
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "transferAuthority",
      "docs": [
        "Transfer master authority to a new account"
      ],
      "discriminator": [
        48,
        169,
        76,
        72,
        229,
        180,
        55,
        161
      ],
      "accounts": [
        {
          "name": "newAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_state.mint",
                "account": "stablecoinState"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "unpause",
      "docs": [
        "Unpause operations"
      ],
      "discriminator": [
        169,
        144,
        4,
        38,
        10,
        141,
        188,
        255
      ],
      "accounts": [
        {
          "name": "pauser",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_state.mint",
                "account": "stablecoinState"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "updateMinter",
      "docs": [
        "Add or update a minter with optional quota"
      ],
      "discriminator": [
        164,
        129,
        164,
        88,
        75,
        29,
        91,
        38
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_state.mint",
                "account": "stablecoinState"
              }
            ]
          }
        },
        {
          "name": "minter"
        },
        {
          "name": "minterState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinState"
              },
              {
                "kind": "account",
                "path": "minter"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateMinterParams"
            }
          }
        }
      ]
    },
    {
      "name": "updateRoles",
      "docs": [
        "Update roles (burner, blacklister, pauser, seizer)"
      ],
      "discriminator": [
        220,
        152,
        205,
        233,
        177,
        123,
        219,
        125
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_state.mint",
                "account": "stablecoinState"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateRolesParams"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "blacklistEntry",
      "discriminator": [
        218,
        179,
        231,
        40,
        141,
        25,
        168,
        189
      ]
    },
    {
      "name": "minterState",
      "discriminator": [
        251,
        69,
        145,
        137,
        48,
        218,
        88,
        148
      ]
    },
    {
      "name": "stablecoinState",
      "discriminator": [
        107,
        33,
        134,
        54,
        129,
        13,
        187,
        151
      ]
    }
  ],
  "events": [
    {
      "name": "accountFrozen",
      "discriminator": [
        221,
        214,
        59,
        29,
        246,
        50,
        119,
        206
      ]
    },
    {
      "name": "accountThawed",
      "discriminator": [
        49,
        63,
        73,
        105,
        129,
        190,
        40,
        119
      ]
    },
    {
      "name": "addedToBlacklist",
      "discriminator": [
        3,
        196,
        78,
        136,
        111,
        197,
        188,
        114
      ]
    },
    {
      "name": "authorityTransferred",
      "discriminator": [
        245,
        109,
        179,
        54,
        135,
        92,
        22,
        64
      ]
    },
    {
      "name": "minterUpdated",
      "discriminator": [
        8,
        124,
        66,
        45,
        176,
        53,
        49,
        153
      ]
    },
    {
      "name": "removedFromBlacklist",
      "discriminator": [
        55,
        136,
        25,
        65,
        199,
        36,
        146,
        33
      ]
    },
    {
      "name": "rolesUpdated",
      "discriminator": [
        81,
        37,
        176,
        32,
        30,
        204,
        251,
        246
      ]
    },
    {
      "name": "stablecoinInitialized",
      "discriminator": [
        238,
        217,
        135,
        14,
        147,
        33,
        221,
        169
      ]
    },
    {
      "name": "stablecoinPaused",
      "discriminator": [
        72,
        123,
        16,
        187,
        50,
        214,
        82,
        198
      ]
    },
    {
      "name": "stablecoinUnpaused",
      "discriminator": [
        183,
        80,
        65,
        60,
        128,
        109,
        155,
        155
      ]
    },
    {
      "name": "tokensBurned",
      "discriminator": [
        230,
        255,
        34,
        113,
        226,
        53,
        227,
        9
      ]
    },
    {
      "name": "tokensMinted",
      "discriminator": [
        207,
        212,
        128,
        194,
        175,
        54,
        64,
        24
      ]
    },
    {
      "name": "tokensSeized",
      "discriminator": [
        51,
        129,
        131,
        114,
        206,
        234,
        140,
        122
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "complianceNotEnabled",
      "msg": "Operation requires SSS-2 compliance mode"
    },
    {
      "code": 6001,
      "name": "paused",
      "msg": "Stablecoin is currently paused"
    },
    {
      "code": 6002,
      "name": "unauthorized",
      "msg": "Unauthorized: missing required role"
    },
    {
      "code": 6003,
      "name": "quotaExceeded",
      "msg": "Minter quota exceeded"
    },
    {
      "code": 6004,
      "name": "blacklisted",
      "msg": "Account is blacklisted"
    },
    {
      "code": 6005,
      "name": "notBlacklisted",
      "msg": "Account is not blacklisted"
    },
    {
      "code": 6006,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6007,
      "name": "nameTooLong",
      "msg": "Name too long (max 32 chars)"
    },
    {
      "code": 6008,
      "name": "symbolTooLong",
      "msg": "Symbol too long (max 10 chars)"
    },
    {
      "code": 6009,
      "name": "uriTooLong",
      "msg": "URI too long (max 200 chars)"
    },
    {
      "code": 6010,
      "name": "reasonTooLong",
      "msg": "Reason too long (max 200 chars)"
    },
    {
      "code": 6011,
      "name": "authorityRequired",
      "msg": "Cannot remove authority - set a new one first"
    },
    {
      "code": 6012,
      "name": "minterAlreadyExists",
      "msg": "Minter already exists"
    },
    {
      "code": 6013,
      "name": "minterNotFound",
      "msg": "Minter not found"
    },
    {
      "code": 6014,
      "name": "maxMintersReached",
      "msg": "Max minters reached (32)"
    },
    {
      "code": 6015,
      "name": "transferHookNotInitialized",
      "msg": "Transfer hook not initialized"
    }
  ],
  "types": [
    {
      "name": "accountFrozen",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "account",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "accountThawed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "account",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "addedToBlacklist",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "authorityTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "oldAuthority",
            "type": "pubkey"
          },
          {
            "name": "newAuthority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "blacklistEntry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "docs": [
              "The blacklisted address"
            ],
            "type": "pubkey"
          },
          {
            "name": "reason",
            "docs": [
              "Reason for blacklisting"
            ],
            "type": "string"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "addedBy",
            "docs": [
              "Who added this entry"
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "initializeParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "decimals",
            "type": "u8"
          },
          {
            "name": "enableCompliance",
            "docs": [
              "Enable SSS-2 compliance features"
            ],
            "type": "bool"
          },
          {
            "name": "enablePermanentDelegate",
            "docs": [
              "Enable permanent delegate (SSS-2)"
            ],
            "type": "bool"
          },
          {
            "name": "enableTransferHook",
            "docs": [
              "Enable transfer hook (SSS-2)"
            ],
            "type": "bool"
          },
          {
            "name": "defaultAccountFrozen",
            "docs": [
              "Default account state frozen (SSS-2)"
            ],
            "type": "bool"
          },
          {
            "name": "transferHookProgramId",
            "docs": [
              "Transfer hook program ID (SSS-2, required if enable_transfer_hook)"
            ],
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "minterState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "minter",
            "docs": [
              "The minter's address"
            ],
            "type": "pubkey"
          },
          {
            "name": "stablecoinState",
            "docs": [
              "The stablecoin state this minter belongs to"
            ],
            "type": "pubkey"
          },
          {
            "name": "quota",
            "docs": [
              "Optional quota (0 = unlimited)"
            ],
            "type": "u64"
          },
          {
            "name": "mintedThisPeriod",
            "docs": [
              "Amount minted so far in this period"
            ],
            "type": "u64"
          },
          {
            "name": "active",
            "docs": [
              "Whether this minter is active"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "minterUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "minter",
            "type": "pubkey"
          },
          {
            "name": "quota",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "removedFromBlacklist",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "rolesUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "stablecoinInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "complianceEnabled",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "stablecoinPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "stablecoinState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Master authority - can do everything"
            ],
            "type": "pubkey"
          },
          {
            "name": "pendingAuthority",
            "docs": [
              "Pending authority for 2-step transfer"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "mint",
            "docs": [
              "The mint account"
            ],
            "type": "pubkey"
          },
          {
            "name": "name",
            "docs": [
              "Token name"
            ],
            "type": "string"
          },
          {
            "name": "symbol",
            "docs": [
              "Token symbol"
            ],
            "type": "string"
          },
          {
            "name": "uri",
            "docs": [
              "Token metadata URI"
            ],
            "type": "string"
          },
          {
            "name": "decimals",
            "docs": [
              "Decimals"
            ],
            "type": "u8"
          },
          {
            "name": "complianceEnabled",
            "docs": [
              "Whether SSS-2 compliance mode is enabled"
            ],
            "type": "bool"
          },
          {
            "name": "permanentDelegateEnabled",
            "docs": [
              "Whether permanent delegate is enabled (SSS-2)"
            ],
            "type": "bool"
          },
          {
            "name": "transferHookEnabled",
            "docs": [
              "Whether transfer hook is enabled (SSS-2)"
            ],
            "type": "bool"
          },
          {
            "name": "defaultAccountFrozen",
            "docs": [
              "Whether new accounts are frozen by default (SSS-2)"
            ],
            "type": "bool"
          },
          {
            "name": "paused",
            "docs": [
              "Whether minting/burning is paused"
            ],
            "type": "bool"
          },
          {
            "name": "pauser",
            "docs": [
              "Pauser role"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "burner",
            "docs": [
              "Burner role"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "blacklister",
            "docs": [
              "Blacklister role (SSS-2)"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "seizer",
            "docs": [
              "Seizer role (SSS-2)"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "totalMinted",
            "docs": [
              "Total minted (for tracking)"
            ],
            "type": "u64"
          },
          {
            "name": "totalBurned",
            "docs": [
              "Total burned"
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "stablecoinUnpaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokensBurned",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "burner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokensMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "minter",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokensSeized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "seizer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "updateMinterParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "quota",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "updateRolesParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pauser",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "burner",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "blacklister",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "seizer",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    }
  ]
};
