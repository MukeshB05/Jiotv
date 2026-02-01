
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { parseM3U } from './services/m3uParser';
import VideoPlayer from './components/VideoPlayer';
import { Channel } from './types';

const M3U_URL = 'https://raw.githubusercontent.com/alex8875/m3u/refs/heads/main/jtv.m3u';
const TITLES = ["Global News", "T20 Cricket", "Super Hit Movie", "Morning Yoga", "Comedy Show", "Wildlife", "Tech Talk", "Doraemon", "Shin-chan", "Marvel HQ", "Nat Geo Wild"];
const SYNC_INTERVAL = 30 * 60 * 1000;

const App: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [favs, setFavs] = useState<string[]>(() => JSON.parse(localStorage.getItem('j_f') || '[]'));
  const [favOnly, setFavOnly] = useState(false);
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem('j_auto_sync') === 'true');
  const [selected, setSelected] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [focused, setFocused] = useState(0);
  const [showUI, setShowUI] = useState(true);
  const [num, setNum] = useState('');
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [time, setTime] = useState(new Date());

  const hideT = useRef<number>(0);
  const numT = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    let filtered = favOnly ? channels.filter(c => favs.includes(c.id)) : channels;
    if (search.trim()) {
      filtered = filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    }
    return filtered;
  }, [channels, favs, favOnly, search]);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter(i => i !== id) : [...favs, id];
    setFavs(next); 
    localStorage.setItem('j_f', JSON.stringify(next));
  };

  const fetchM3U = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setSyncing(true);
    try {
      const response = await fetch(`${M3U_URL}?t=${Date.now()}`);
      const text = await response.text();
      const parsed = parseM3U(text);
      setChannels(parsed);
      if (!isSilent && parsed.length > 0) setSelected(parsed[0]);
    } catch (e) {
      console.error("Failed to fetch M3U", e);
    } finally {
      setLoading(false);
      if (isSilent) setTimeout(() => setSyncing(false), 2000);
    }
  }, []);

  const getEPG = (id: string, t: Date) => {
    const m = t.getHours() * 60 + t.getMinutes(), cycle = 30;
    const idx = Math.floor(m / cycle);
    const start = idx * cycle, end = (idx + 1) * cycle;
    const fmt = (v: number) => { 
      const h = Math.floor(v/60)%24, min = v%60; 
      return `${h%12||12}:${min<10?'0':''}${min} ${h>=12?'PM':'AM'}`; 
    };
    const hash = (s: string) => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
    const channelSeed = Math.abs(hash(id));
    
    return { 
      current: {
        title: TITLES[(channelSeed + idx) % TITLES.length],
        range: `${fmt(start)} - ${fmt(end)}`,
        pct: ((m % cycle) / cycle) * 100
      },
      next: {
        title: TITLES[(channelSeed + idx + 1) % TITLES.length],
        range: `${fmt(end)} - ${fmt(end + cycle)}`
      }
    };
  };

  const resetUI = () => { 
    setShowUI(true); 
    clearTimeout(hideT.current); 
    if (!isSearching) hideT.current = window.setTimeout(() => setShowUI(false), 8000); 
  };

  useEffect(() => {
    fetchM3U();
    const itv = setInterval(() => setTime(new Date()), 30000); 
    return () => clearInterval(itv);
  }, [fetchM3U]);

  useEffect(() => {
    if (!autoSync) return;
    const syncItv = setInterval(() => fetchM3U(true), SYNC_INTERVAL);
    return () => clearInterval(syncItv);
  }, [autoSync, fetchM3U]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') {
        if (e.key === 'Escape') { searchRef.current?.blur(); setIsSearching(false); resetUI(); }
        return;
      }
      if (/^\d$/.test(e.key)) {
        resetUI();
        const currentNum = (num + e.key).slice(-3);
        setNum(currentNum);
        clearTimeout(numT.current);
        numT.current = window.setTimeout(() => {
          const index = parseInt(currentNum) - 1;
          if (list[index]) { setSelected(list[index]); setFocused(index); }
          setNum('');
        }, 1500);
        return;
      }
      resetUI();
      if (e.key === 'ArrowRight') setFocused(p => Math.min(p + 1, list.length - 1));
      if (e.key === 'ArrowLeft') setFocused(p => Math.max(p - 1, 0));
      if (e.key === 'ArrowUp') setFocused(p => Math.max(p - 5, 0));
      if (e.key === 'ArrowDown') setFocused(p => Math.min(p + 5, list.length - 1));
      if (e.key === 'Enter') list[focused] && setSelected(list[focused]);
      if (e.key === 'f' || e.key === 'F') selected && toggleFav(selected.id);
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler); 
    return () => window.removeEventListener('keydown', handler);
  }, [list, focused, selected, isSearching, num]);

  useEffect(() => { 
    document.getElementById(`c-${focused}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center' }); 
  }, [focused]);

  if (loading) return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center">
      <h1 className="text-5xl font-black italic text-white animate-pulse">JIO TV<span className="text-blue-500">+</span></h1>
      <p className="text-blue-500 font-bold tracking-[0.3em] text-[10px] mt-8 uppercase opacity-50">Initializing Stream</p>
    </div>
  );

  const epg = selected ? getEPG(selected.id, time) : null;
  const channelIndex = selected ? channels.indexOf(selected) + 1 : 0;

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden font-['Outfit']" onClick={resetUI}>
      <VideoPlayer channel={selected} />

      {/* Top Bar Clock */}
      <div className={`fixed top-8 left-12 z-50 transition-opacity duration-700 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-3 text-white/90 font-semibold text-xl">
          <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="opacity-40">|</span>
          <span>{time.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Numeric Jump Overlay */}
      {num && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl animate-jump">
          <span className="text-[12rem] font-black italic tracking-tighter text-white drop-shadow-[0_0_50px_rgba(59,130,246,0.5)]">{num}</span>
          <div className="w-64 h-2 bg-white/10 mt-6 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-progress" key={num}></div>
          </div>
        </div>
      )}

      {/* Main Overlay UI */}
      <div className={`fixed bottom-0 inset-x-0 transition-all duration-700 pointer-events-none ${showUI ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
        
        {/* Channel Info Bar (Reference Style) */}
        <div className="w-full bg-gradient-to-t from-black via-black/90 to-transparent pt-32 pb-8 px-12 pointer-events-auto">
          <div className="max-w-[1600px] mx-auto">
            
            {/* Upper Metadata Row */}
            <div className="flex items-end justify-between mb-6">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                   <span className="text-6xl font-black italic text-white leading-none tracking-tighter">{channelIndex}</span>
                   <div className="h-12 w-0.5 bg-white/20 mx-2"></div>
                   <div className="flex flex-col">
                      <h2 className="text-4xl font-bold text-white tracking-tight leading-tight">{selected?.name} <span className="text-white/40 font-medium text-2xl ml-2">@ Rs 12</span></h2>
                      <div className="flex items-center gap-3 mt-1 text-white/40 text-xs font-bold tracking-widest uppercase">
                        <span className="px-1.5 py-0.5 border border-white/20 rounded">HD</span>
                        <span className="px-1.5 py-0.5 border border-white/20 rounded">DOLBY</span>
                        <span className="px-1.5 py-0.5 border border-white/20 rounded">4K</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> LIVE</span>
                      </div>
                   </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button onClick={() => { setFavOnly(!favOnly); setFocused(0); }} className={`px-6 py-2.5 rounded-full text-[11px] font-black tracking-widest transition-all ${favOnly ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60'}`}>
                  {favOnly ? '★ FAVORITES' : '☆ ALL CHANNELS'}
                </button>
                <button onClick={() => setAutoSync(!autoSync)} className={`p-2.5 rounded-full transition-all ${autoSync ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/40'}`}>
                  <svg className={`w-5 h-5 ${autoSync ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>

            {/* Program Details Section */}
            <div className="grid grid-cols-12 gap-8 items-start">
              
              {/* Current Program */}
              <div className="col-span-8">
                <div className="flex gap-6 items-start">
                  <div className="w-44 h-28 rounded-2xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10 shadow-2xl">
                    <img src={selected?.logo} className="w-full h-full object-contain p-4 bg-black/40" alt="Logo" />
                  </div>
                  <div className="flex-grow pt-1">
                    <h3 className="text-2xl font-bold text-white mb-1">{epg?.current.title}</h3>
                    <p className="text-blue-400/80 font-bold text-sm tracking-wide mb-4">Now: {epg?.current.range}</p>
                    <div className="relative h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="absolute top-0 left-0 h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]" style={{ width: `${epg?.current.pct}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Program Preview */}
              <div className="col-span-4 bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-md">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-white/30 tracking-[0.2em] uppercase">Upcoming</span>
                  <div className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-bold text-white/60">Options ☰</div>
                </div>
                <h4 className="text-lg font-bold text-white/90 leading-tight mb-1">{epg?.next.title}</h4>
                <p className="text-white/40 text-xs font-semibold">{epg?.next.range}</p>
              </div>
            </div>

            {/* Channel List Scroller */}
            <div className="mt-10 mb-2 relative group/search">
               <input 
                  ref={searchRef}
                  type="text" 
                  placeholder="Search channels... (Press /)" 
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setFocused(0); }}
                  onFocus={() => setIsSearching(true)}
                  onBlur={() => { setIsSearching(false); resetUI(); }}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-6 pr-4 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-white/10 text-white/60 mb-6"
                />
            </div>
            
            <div className="flex gap-4 overflow-x-auto no-scrollbar py-4" ref={scrollRef}>
              {list.map((c, i) => (
                <div id={`c-${i}`} key={c.id + i} onClick={() => { setSelected(c); setFocused(i); }} 
                     className={`flex-shrink-0 w-24 h-24 p-3 rounded-2xl transition-all duration-300 cursor-pointer relative group ${focused === i ? 'ring-2 ring-blue-500 bg-white/15 scale-110 -translate-y-2' : 'bg-white/5 opacity-40 hover:opacity-80'}`}>
                  <img src={c.logo} className="w-full h-full object-contain" alt={c.name} />
                  <span className="absolute -top-2 -right-2 bg-black border border-white/10 text-[9px] font-bold px-1.5 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">#{channels.indexOf(c)+1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
