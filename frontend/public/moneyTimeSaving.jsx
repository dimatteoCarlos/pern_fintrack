import React from 'react';
import { motion } from 'framer-motion';
import { Clock, DollarSign, ArrowUpRight } from 'lucide-react';

const MoneyTimeSavingIcon = () => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      style={{ backgroundColor: 'black', borderRadius: '50%' }}
      className="rounded-full border-2 border-white p-2 flex items-center justify-center"
       // Centrar el contenido
    >
      <g className="relative">
        {/* Reloj de fondo (más sutil) */}
        <Clock
          className="text-white w-6 h-6 opacity-0.3" // Más grande y transparente
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Signo de Dólar prominente */}
        <DollarSign
          className="text-green-400 w-8 h-8" // Más grande y en color verde
          style={{
            position: 'absolute',
            top: '35%', // Ajustado para que esté un poco más arriba
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Flecha hacia arriba y a la derecha */}
        <ArrowUpRight
          className="text-white w-5 h-5"
          style={{
            position: 'absolute',
            top: '65%', // Ajustado para que esté un poco más abajo
            left: '65%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </g>
    </motion.svg>
  );
};

export default MoneyTimeSavingIcon;
