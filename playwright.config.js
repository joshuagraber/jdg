"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var test_1 = require("@playwright/test");
require("dotenv/config");
var PORT = process.env.PORT || '3000';
exports["default"] = (0, test_1.defineConfig)({
    testDir: './tests/e2e',
    timeout: 15 * 1000,
    expect: {
        timeout: 5 * 1000
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: "http://localhost:".concat(PORT, "/"),
        trace: 'on-first-retry'
    },
    projects: [
        {
            name: 'chromium',
            use: __assign({}, test_1.devices['Desktop Chrome'])
        },
    ],
    webServer: {
        command: process.env.CI ? 'npm run start:mocks' : 'npm run dev',
        port: Number(PORT),
        reuseExistingServer: true,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
            PORT: PORT,
            NODE_ENV: 'test'
        }
    }
});
