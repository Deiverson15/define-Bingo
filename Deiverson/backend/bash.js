// generarHash.js
const bcrypt = require('bcrypt');

const passwordPlana = 'javier'; // <-- Cambia esto por la contraseña del nuevo usuario
const saltRounds = 10;

bcrypt.hash(passwordPlana, saltRounds, (err, hash) => {
  if (err) {
    console.error("Error al generar el hash:", err);
    return;
  }
  console.log('Tu contraseña plana:', passwordPlana);
  console.log('Tu hash seguro (cópialo completo):');
  console.log(hash);
});


