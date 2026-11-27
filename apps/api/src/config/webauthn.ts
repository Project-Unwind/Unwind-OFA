const requiredVariables = [
  'RP_NAME',
  'RP_ID',
  'EXPECTED_ORIGIN',
] as const;

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing ${variable} in API environment.`);
  }
}

const webauthnConfig = {
  rpName: process.env.RP_NAME as string,
  rpID: process.env.RP_ID as string,
  expectedOrigin: process.env.EXPECTED_ORIGIN as string,
};

module.exports = { webauthnConfig };