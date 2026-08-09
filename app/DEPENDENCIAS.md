# Isolamento de dependências do app mobile

O site e o app usam versões diferentes de React por necessidade de compatibilidade:

- web/Next: React 19.2.x
- app/Expo SDK 54: React 19.1.0 + React Native 0.81.5

Por isso `app` não faz mais parte do workspace npm da raiz.

A raiz gerencia apenas `web`, enquanto `app` possui seu próprio `node_modules`
e seu próprio `package-lock.json`. Isso evita que React/React Native do site
entrem no bundle do Expo Go.

## Instalação limpa

Na raiz do projeto:

```bat
taskkill /F /IM node.exe 2>nul

rmdir /s /q node_modules 2>nul
rmdir /s /q app\node_modules 2>nul
rmdir /s /q app\.expo 2>nul

del /f /q app\package-lock.json 2>nul

npm install
npm --prefix app install
```

Depois:

```bat
npm run mobile:typecheck
npm run mobile:go
```

O `package-lock.json` da raiz pertence ao site/workspace web.
O `app/package-lock.json` pertence ao Expo e deve ser mantido após a instalação.
