import React from 'react';
import SnakeGame from './components/SnakeGame';

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <SnakeGame />
    </div>
  );
};

export default App;