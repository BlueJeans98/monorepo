import React from 'react';
import { useSocket } from 'socket.io-react-hook';

import logo from './logo.svg';
import './App.css';

function App() {
  const { socket, connected } = useSocket(
    '/',
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
        host: 'localhost:3567',
      },
  );

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          {connected ? 'Connected!' : 'Disconnected!'}
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
