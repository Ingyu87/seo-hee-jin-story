'use client';
import { useGame, HEROES } from './store';

export function Hud() {
  const s = useGame();
  const h = HEROES[s.hero];
  const line = s.lines[s.lineIdx];

  if (s.scene === 'select') {
    return (
      <div className="hud">
        <div className="title">
          <h1>백설공주와 일곱 난쟁이</h1>
          <p>동화 속으로 들어갈 친구를 골라 줘!</p>
        </div>
        <div className="select-bar">
          {(['seohui', 'seojin'] as const).map((id) => (
            <button key={id} className={`card ${s.hero === id ? 'on' : ''}`} onClick={() => s.setHero(id)}
              style={{ borderColor: s.hero === id ? HEROES[id].color : undefined }}>
              <b>{HEROES[id].name}</b><span>{HEROES[id].age}살</span>
            </button>
          ))}
          <button className="start" onClick={() => s.start()}>{h.ro} 동화 속에 들어가기 ▶</button>
        </div>
      </div>
    );
  }

  if (s.scene === 'ending') {
    return (
      <div className="hud">
        <div className="ending">
          <h2>{s.ending === 'safe' ? '🎉 해피엔딩!' : '🌟 해피엔딩!'}</h2>
          <p>{s.ending === 'safe'
            ? `${h.subj} 수상한 사과를 먹지 않아서 모두가 안전했어요. 일곱 난쟁이와 백설공주는 신나는 파티를 열었답니다.`
            : `모두가 힘을 합쳐 ${h.obj} 깨웠어요. 난쟁이들과 백설공주는 오래오래 행복하게 살았답니다.`}</p>
          <div className="row">
            <button onClick={() => s.start()}>다시 하기</button>
            <button onClick={() => s.reset()}>캐릭터 바꾸기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hud">
      <div className="topbar">
        <span className="who" style={{ background: h.color }}>{h.name} · {h.age}살</span>
        <span className="place">{s.scene === 'forest' ? '🌲 숲속 길' : '🏠 일곱 난쟁이의 오두막'}</span>
        <button className="ghost" onClick={() => s.reset()}>처음으로</button>
      </div>
      {s.hint && !line && <div className="hint">{s.hint}</div>}
      {s.toast && <div className="toast">{s.toast}</div>}
      {s.scene === 'forest' && s.swFollow && !line && (
        <button className="shortcut" onClick={() => s.goto('cottage')}>🏠 오두막으로 바로 가기</button>
      )}
      {s.scene === 'cottage' && s.sitting && !line && (
        <button className="shortcut" onClick={() => s.standUp()}>일어나기</button>
      )}
      {s.sleeping && !line && (
        <div className="tapzone" onClick={() => s.tap()}>
          <div className="tapmsg">💤 {h.subj} 잠들었어! 화면을 톡톡 눌러서 깨워 줘! <b>{s.taps}/5</b></div>
        </div>
      )}
      {line && (
        <div className="dialog" onClick={() => !line.choices && s.next()}>
          <div className="speaker">{line.speaker}</div>
          <div className="text">{line.text}</div>
          {line.choices ? (
            <div className="choices">
              {line.choices.map((c) => (
                <button key={c.id} onClick={(e) => { e.stopPropagation(); s.choose(c.id); }}>{c.label}</button>
              ))}
            </div>
          ) : <div className="more">눌러서 계속 ▼</div>}
        </div>
      )}
    </div>
  );
}
