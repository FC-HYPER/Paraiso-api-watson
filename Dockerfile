# Estágio de compilação: precisa das devDependencies (tsup, typescript).
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

# --legacy-peer-deps é obrigatório: fastify-zod@1.4.0 declara peer fastify@^4.15.0
# e o projeto roda fastify 5. Sem a flag o npm ci falha com ERESOLVE e o build morre.
RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

# Estágio final: leva apenas o que executa. Sem tsup, typescript, eslint, vite e
# prettier, o node_modules cai de 199 MB para 59 MB.
# As camadas do Docker são acumulativas: podar num RUN posterior não devolveria
# espaço, porque os arquivos continuariam na camada anterior. Por isso dois estágios.
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=build /usr/src/app/build ./build

CMD [ "npm", "start" ]
