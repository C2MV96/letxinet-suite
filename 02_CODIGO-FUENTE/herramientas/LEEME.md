# herramientas

`recompilar-todo.ps1` busca aquí el binario base de Node 22 que usa yao-pkg para generar el `.exe` de V11:

```
herramientas/pkg-cache/v3.6/fetched-v22.23.1-win-x64
```

No está en el repositorio porque pesa 55 MB. Es opcional: si falta, yao-pkg lo descarga de GitHub durante la compilación. Para compilar sin internet, copia ese archivo desde `%USERPROFILE%\.pkg-cache\v3.6\` de un equipo donde ya se haya compilado.
