import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 font-sans text-neutral-100 selection:bg-indigo-500/30">
      <div className="max-w-3xl w-full bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-3xl p-10 md:p-16 shadow-2xl relative overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center text-center space-y-8">
          <div className="flex gap-6 items-center flex-wrap justify-center mb-4">
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform duration-300">
              <span className="text-3xl font-bold text-white">Re</span>
            </div>
            <div className="text-3xl font-light text-neutral-600">+</div>
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-300 to-orange-500 shadow-lg shadow-orange-500/30 hover:scale-105 transition-transform duration-300">
              <span className="text-3xl font-bold text-white">Vi</span>
            </div>
            <div className="text-3xl font-light text-neutral-600">+</div>
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 shadow-lg shadow-indigo-500/30 hover:scale-105 transition-transform duration-300">
              <span className="text-3xl font-bold text-white">Tw</span>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              Next-Gen Template
            </h1>
            <p className="text-lg md:text-xl text-neutral-400 max-w-xl mx-auto font-light">
              Experience the blazing fast development with <strong className="text-neutral-200 font-medium">React</strong>, <strong className="text-neutral-200 font-medium">Vite</strong>, <strong className="text-neutral-200 font-medium">TypeScript</strong>, and beautifully crafted with <strong className="text-neutral-200 font-medium">Tailwind CSS</strong>.
            </p>
          </div>

          <div className="pt-8">
            <button 
              onClick={() => setCount((c) => c + 1)}
              className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 font-semibold text-white transition-all duration-200 bg-indigo-600 border border-transparent rounded-full hover:bg-indigo-500 hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 focus:ring-offset-neutral-900"
            >
              <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black" />
              <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Count is {count}
            </button>
          </div>
          
          <div className="pt-10 flex gap-6 text-sm text-neutral-500">
            <a href="https://react.dev" target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">React Docs</a>
            <a href="https://vitejs.dev" target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">Vite Docs</a>
            <a href="https://tailwindcss.com" target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">Tailwind CSS</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
