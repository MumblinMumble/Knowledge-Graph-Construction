import React from 'react';
import Graph from './components/Graph/Graph.jsx';
import './styles/App.css';

function App() {
  return (
    <div className="kg-root">
      <div className="kg-shell">
        <header className="kg-header">
          <div className="kg-title-block">
            <h1 className="kg-title">Knowledge Graph</h1>
            <p className="kg-subtitle">
              Build, explore and refine relationships in your data.
            </p>
          </div>
        </header>

        <main className="kg-main">
          <Graph />
        </main>
      </div>
    </div>
  );
}

export default App;
