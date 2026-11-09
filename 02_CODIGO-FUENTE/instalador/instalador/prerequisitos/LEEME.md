# prerequisitos

El instalador incluye Node.js y lo instala solo si falta en el equipo. Inno Setup busca aquí:

```
node-v22.23.4-x64.msi
```

No está en el repositorio porque pesa 30 MB. Descárgalo de https://nodejs.org/dist/v22.23.4/node-v22.23.4-x64.msi y déjalo en esta carpeta antes de ejecutar `recompilar-todo.cmd`. Si usas otra versión, cambia `NodeMsi` en `LetXinet-Suite.iss`.
