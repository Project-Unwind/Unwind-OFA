const requiredVariables = [
  'RP_NAME',
  'RP_ID',
  'EXPECTED_ORIGIN',
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing ${variable} in API environment.`);
  }
}

const webauthnConfig = {
  rpName: process.env.RP_NAME,
  rpID: process.env.RP_ID,
  expectedOrigin: process.env.EXPECTED_ORIGIN,
};

module.exports = { webauthnConfig };