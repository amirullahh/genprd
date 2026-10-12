import next from "eslint-config-next";

const config = [...next, { ignores: [".next/**", "node_modules/**", "drizzle/**"] }];

export default config;
