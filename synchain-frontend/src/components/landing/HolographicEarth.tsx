import React from 'react';
import styled from 'styled-components';

export const HolographicEarth = () => {
  return (
    <StyledWrapper>
      <div className="sphere-container">
        <div className="sphere">
          {/* Meridians */}
          {[...Array(36)].map((_, i) => (
            <div key={`meridian-${i}`} className="meridian" />
          ))}

          {/* Latitudes */}
          {[...Array(12)].map((_, i) => (
            <div key={`latitude-${i}`} className="latitude" />
          ))}

          {/* Axes */}
          <div className="axis" />
          <div className="axis" />

          {/* Glowing Nodes & Routes */}
          <div className="node node-1" />
          <div className="node node-2" />
          <div className="node node-3" />
          <div className="node node-4" />
          
          <svg className="routes-svg">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* The SVG is positioned absolutely inside the rotating sphere to give a continuous line effect. 
                We use raw SVG paths rotated in 3D to simulate connected lines. */}
          </svg>
          
          {/* Simulated 3D routes using curved divs */}
          <div className="route route-1" />
          <div className="route route-2" />
        </div>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  .sphere-container {
    position: relative;
    width: 320px;
    height: 320px;
    perspective: 1000px;
  }

  /* Add a subtle ambient cyan glow behind the earth */
  .sphere-container::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 250px;
    height: 250px;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(14,165,233,0.15) 0%, rgba(14,165,233,0) 70%);
    border-radius: 50%;
    filter: blur(20px);
    pointer-events: none;
  }

  .sphere {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    overflow: visible;
    border-radius: 100%;
    transform-style: preserve-3d;
    animation: rotate 20s linear infinite;
    position: relative;
  }

  /* Meridian styles */
  .sphere .meridian {
    position: absolute;
    width: 320px;
    height: 320px;
    border: 1px solid rgba(14, 165, 233, 0.15);
    border-radius: 100%;
    transform-style: preserve-3d;
    box-shadow: inset 0 0 15px rgba(59, 130, 246, 0.05), 0 0 5px rgba(14, 165, 233, 0.05);
  }
  
  ${[...Array(36)].map((_, i) => `
    .sphere .meridian:nth-child(${i + 1}) {
      transform: rotateX(${i * 10}deg);
    }
  `).join('\n')}

  /* Latitude styles */
  .sphere .latitude {
    position: absolute;
    width: 320px;
    height: 320px;
    border: 1px solid rgba(14, 165, 233, 0.15);
    transform: rotateY(90deg);
    border-radius: 100%;
    box-shadow: inset 0 0 10px rgba(6, 182, 212, 0.1), 0 0 8px rgba(14, 165, 233, 0.1);
  }
  
  .sphere .latitude:nth-child(37) {
    width: 316px; height: 316px; top: 2px; left: 2px; transform: rotateY(90deg) translateZ(-25px);
  }
  .sphere .latitude:nth-child(38) {
    width: 298px; height: 298px; top: 11px; left: 11px; transform: rotateY(90deg) translateZ(-50px);
  }
  .sphere .latitude:nth-child(39) {
    width: 276px; height: 276px; top: 22px; left: 22px; transform: rotateY(90deg) translateZ(-75px);
  }
  .sphere .latitude:nth-child(40) {
    width: 236px; height: 236px; top: 42px; left: 42px; transform: rotateY(90deg) translateZ(-100px);
  }
  .sphere .latitude:nth-child(41) {
    width: 172px; height: 172px; top: 74px; left: 74px; transform: rotateY(90deg) translateZ(-125px);
  }
  /* pole dot */
  .sphere .latitude:nth-child(42) {
    width: 20px; height: 20px; top: 150px; left: 150px;
    border: 6px solid rgba(14, 165, 233, 0.6);
    transform: rotateY(90deg) translateZ(-150px);
    box-shadow: 0 0 15px rgba(6, 182, 212, 0.8);
    background: #fff;
  }
  
  .sphere .latitude:nth-child(43) {
    width: 316px; height: 316px; top: 2px; left: 2px; transform: rotateY(90deg) translateZ(25px);
  }
  .sphere .latitude:nth-child(44) {
    width: 298px; height: 298px; top: 11px; left: 11px; transform: rotateY(90deg) translateZ(50px);
  }
  .sphere .latitude:nth-child(45) {
    width: 276px; height: 276px; top: 22px; left: 22px; transform: rotateY(90deg) translateZ(75px);
  }
  .sphere .latitude:nth-child(46) {
    width: 236px; height: 236px; top: 42px; left: 42px; transform: rotateY(90deg) translateZ(100px);
  }
  .sphere .latitude:nth-child(47) {
    width: 172px; height: 172px; top: 74px; left: 74px; transform: rotateY(90deg) translateZ(125px);
  }
  /* pole dot */
  .sphere .latitude:nth-child(48) {
    width: 20px; height: 20px; top: 150px; left: 150px;
    border: 6px solid rgba(14, 165, 233, 0.6);
    transform: rotateY(90deg) translateZ(150px);
    box-shadow: 0 0 15px rgba(6, 182, 212, 0.8);
    background: #fff;
  }

  /* Axis styles */
  .sphere .axis {
    position: absolute;
    width: 600px;
    height: 1px;
    top: calc(50% - 0.5px);
    left: -140px;
    background: linear-gradient(to left, transparent, rgba(59, 130, 246, 0.4), transparent);
    box-shadow: 0 0 10px rgba(14, 165, 233, 0.4);
  }
  .sphere .axis:nth-child(50) {
    transform: rotateX(90deg);
  }

  /* Glowing Supply Chain Nodes */
  .node {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 0 15px 4px rgba(6, 182, 212, 0.9);
  }
  
  .node-1 { top: 70px; left: 100px; transform: translateZ(140px); }
  .node-2 { top: 220px; left: 240px; transform: translateZ(90px); }
  .node-3 { top: 150px; left: 40px; transform: translateZ(-130px); }
  .node-4 { top: 270px; left: 140px; transform: translateZ(100px); }

  /* Connecting Routes */
  .route {
    position: absolute;
    border: 1.5px dashed rgba(6, 182, 212, 0.8);
    border-radius: 50%;
    transform-style: preserve-3d;
    box-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
  }
  
  .route-1 {
    width: 220px;
    height: 220px;
    top: 50px;
    left: 50px;
    transform: rotateX(60deg) rotateY(20deg) translateZ(40px);
    clip-path: polygon(0 0, 100% 0, 100% 50%, 0 50%); /* Half circle arc */
  }

  .route-2 {
    width: 180px;
    height: 180px;
    top: 70px;
    left: 70px;
    transform: rotateX(-45deg) rotateY(40deg) translateZ(-60px);
    clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%); /* Quarter circle arc */
  }

  @keyframes rotate {
    0% {
      transform: rotateX(20deg) rotateY(0deg) rotateZ(10deg);
    }
    100% {
      transform: rotateX(20deg) rotateY(360deg) rotateZ(10deg);
    }
  }
`;
