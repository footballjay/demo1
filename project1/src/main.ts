import './styles.css';

/* ===================== 타입 ===================== */
type Severity = 'mild' | 'watch' | 'urgent';
type BodyPart = 'knee' | 'ankle' | 'other';
type Choice = 'yes' | 'no' | 'unknown';
type SignalCategory = 'external' | 'internal' | 'function';

interface SpeechRecognitionLike { lang:string; continuous:boolean; interimResults:boolean; onstart:()=>void; onresult:(event:SpeechRecognitionEventLike)=>void; onend:()=>void; onerror:(event:SpeechRecognitionErrorEventLike)=>void; start:()=>void; stop:()=>void }
interface SpeechRecognitionEventLike { resultIndex:number; results:{ [index:number]:{ 0:{ transcript:string }; isFinal:boolean }; length:number } }
interface SpeechRecognitionErrorEventLike { error:string }
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface Option { id:string; label:string; icon:string }
interface SignalDef { id:string; label:string; category:SignalCategory; positiveOnNo?:boolean }
interface PatternDef {
  id:string; part:'knee'|'ankle'; name:string; moi:string; location:string;
  signals:string[]; urgent?:boolean; specialty:string; confirm:string;
}
interface InjuryState {
  story:string; part:BodyPart|''; moi:string; location:string;
  signals:Record<string,Choice>; pain:number;
  redFlags:{ deformity:Choice; weightBearing:Choice; sensation:Choice; locking:Choice };
}
interface Candidate { name:string; confidence:string; reason:string; confirm:string }
interface Assessment { severity:Severity; title:string; summary:string; candidates:Candidate[]; specialty:string; urgentSignals:string[] }

/* ===================== 손상기전(MOI) · 통증위치 선택지 ===================== */
const KNEE_MOI:Option[] = [
 {id:'impact',label:'충돌 등 외부 충격을 받았어요',icon:'💥'},
 {id:'twist',label:'방향을 바꾸거나 비틀렸어요',icon:'↻'},
 {id:'varus',label:'무릎이 안쪽으로 꺾였어요',icon:'⇐'},
 {id:'repetitive',label:'걷기·달리기·계단·스쿼트를 반복했어요',icon:'▥'},
 {id:'jump_land',label:'점프 후 착지하거나 무릎을 자주 폈어요',icon:'⇣'},
 {id:'run_jump_kneel',label:'달리기·점프·무릎 꿇는 동작을 했어요',icon:'🏃'},
 {id:'forceful_kick',label:'강하게 무릎을 펴는 순간(킥·점프) 다쳤어요',icon:'⚡'},
 {id:'fall_rotate',label:'무릎을 굽힌 채 넘어지거나 돌아갔어요',icon:'↺'},
 {id:'stop_hyperextend',label:'급정지·방향전환 중 무릎이 꺾였어요',icon:'⛔'},
];
const KNEE_LOCATION:Option[] = [
 {id:'inner',label:'무릎 안쪽',icon:'←'},
 {id:'inner_joint_line',label:'안쪽 관절선 부근',icon:'⇠'},
 {id:'outer',label:'무릎 바깥쪽',icon:'→'},
 {id:'outer_joint_line',label:'바깥쪽 관절선 부근',icon:'⇢'},
 {id:'front_patellar',label:'무릎 앞쪽·슬개골 전체',icon:'↑'},
 {id:'below_patellar',label:'슬개골 아래',icon:'↓'},
 {id:'below_patellar_tibial',label:'슬개골 아래~정강이 위쪽',icon:'⇊'},
 {id:'back',label:'무릎 뒤쪽',icon:'↩'},
 {id:'deep_whole',label:'무릎 깊은 곳·전체',icon:'◎'},
];
const ANKLE_MOI:Option[] = [
 {id:'inversion',label:'발이 안쪽으로 꺾이며 접질렸어요',icon:'⇙'},
 {id:'eversion',label:'발이 바깥쪽으로 꺾이며 접질렸어요',icon:'⇘'},
 {id:'fixed_rotation',label:'발이 고정된 채 몸이 돌아갔어요',icon:'↻'},
 {id:'overstretch',label:'발목이 발등 쪽으로 급격히 젖혀졌어요',icon:'⇡'},
 {id:'gradual',label:'특별한 사고 없이 서서히 아파졌어요',icon:'⏳'},
 {id:'sudden_stopgo',label:'갑자기 멈추거나 방향을 바꿨어요',icon:'⛔'},
 {id:'high_impact',label:'추락·강한 충돌 등 큰 충격을 받았어요',icon:'💥'},
];
const ANKLE_LOCATION:Option[] = [
 {id:'lateral_malleolus',label:'바깥쪽 복숭아뼈 주변',icon:'→'},
 {id:'medial_ankle',label:'안쪽 발목',icon:'←'},
 {id:'front_upper_lateral',label:'발목 앞쪽·위쪽/전외측',icon:'↗'},
 {id:'achilles_back',label:'발목 뒤쪽·아킬레스건',icon:'↩'},
 {id:'whole_ankle',label:'발목 전체',icon:'◎'},
];

/* ===================== 구별 신호(외적/내적/기능) 카탈로그 ===================== */
const SIGNALS:Record<string,SignalDef> = {
 swelling:{id:'swelling',label:'붓기가 있나요?',category:'external'},
 delayed_swelling:{id:'delayed_swelling',label:'다치고 시간이 지나면서 붓기가 생겼나요?',category:'external'},
 recurring_swelling:{id:'recurring_swelling',label:'이 동작을 할 때마다 반복적으로 붓기가 생기나요?',category:'external'},
 rapid_swelling:{id:'rapid_swelling',label:'다치자마자 빠르게 붓기 시작했나요?',category:'external'},
 severe_swelling:{id:'severe_swelling',label:'심하게 부었나요?',category:'external'},
 swelling_color_change:{id:'swelling_color_change',label:'붓기와 함께 피부색도 변했나요?',category:'external'},
 bruise:{id:'bruise',label:'멍이 들었나요?',category:'external'},
 rom_limit:{id:'rom_limit',label:'평소만큼 굽히거나 펴기 어려운가요?',category:'external'},
 tenderness:{id:'tenderness',label:'눌렀을 때 그 부위가 아픈가요?',category:'internal'},
 localized_tenderness:{id:'localized_tenderness',label:'통증이 한 지점에 뚜렷하게 있나요?',category:'internal'},
 stiffness:{id:'stiffness',label:'뻣뻣한 느낌이 있나요?',category:'internal'},
 instability_giving_way:{id:'instability_giving_way',label:'흔들리거나 꺾일 것 같은 불안정한 느낌이 있나요?',category:'internal'},
 locking_catching:{id:'locking_catching',label:'걸리거나 잠기는 느낌(locking)이 있나요?',category:'internal'},
 crepitus_on_bend:{id:'crepitus_on_bend',label:'굽혔다 펼 때 갈리는 느낌이 있나요?',category:'internal'},
 crepitus:{id:'crepitus',label:'움직일 때 삐걱거리거나 마찰되는 느낌이 있나요?',category:'internal'},
 pop_snap:{id:'pop_snap',label:'다칠 때 뚝(pop)/딱(snap) 소리나 느낌이 있었나요?',category:'internal'},
 pop_back:{id:'pop_back',label:'다칠 때 뒤쪽에서 뚝 하는 느낌이 있었나요?',category:'internal'},
 weakness:{id:'weakness',label:'힘이 빠지는 느낌이 있나요?',category:'internal'},
 morning_stiffness:{id:'morning_stiffness',label:'아침에 뻣뻣한 느낌이 특히 심한가요?',category:'internal'},
 general_pain:{id:'general_pain',label:'한 지점보다 전반적으로 아픈가요?',category:'internal'},
 sudden_snap:{id:'sudden_snap',label:'갑자기 뚝 끊어지는 느낌이 있었나요?',category:'internal'},
 immediate_pain:{id:'immediate_pain',label:'다치자마자 바로 심한 통증이 있었나요?',category:'internal'},
 sudden_severe_pain_swelling:{id:'sudden_severe_pain_swelling',label:'갑자기 심한 통증과 붓기가 함께 생겼나요?',category:'internal'},
 severe_pain:{id:'severe_pain',label:'통증이 매우 심한가요?',category:'internal'},
 cannot_extend:{id:'cannot_extend',label:'스스로 무릎을 곧게 펼 수 있나요?',category:'function',positiveOnNo:true},
 pain_on_dorsiflexion:{id:'pain_on_dorsiflexion',label:'발등 쪽으로 발목을 젖히면 통증이 심해지나요?',category:'function'},
 function_loss:{id:'function_loss',label:'평소처럼 그 부위를 움직이거나 사용할 수 있나요?',category:'function',positiveOnNo:true},
 function_status:{id:'function_status',label:'지금 그 부위를 평소처럼 사용할 수 있나요?',category:'function',positiveOnNo:true},
};

/* ===================== 손상 패턴(기전 × 위치 → 의심 손상) ===================== */
const KNEE_PATTERNS:PatternDef[] = [
 {id:'mcl',part:'knee',name:'내측측부인대(MCL) 손상 의심',moi:'impact',location:'inner',
  signals:['tenderness','swelling','stiffness','instability_giving_way'],
  specialty:'정형외과',confirm:'무릎 안쪽 인대 압통과 외반 스트레스 검사'},
 {id:'medial_meniscus',part:'knee',name:'내측 반월상연골 손상 의심',moi:'twist',location:'inner_joint_line',
  signals:['delayed_swelling','rom_limit','locking_catching','instability_giving_way'],
  specialty:'정형외과',confirm:'관절선 압통, 잠김 여부, McMurray 검사 등'},
 {id:'lcl',part:'knee',name:'외측측부인대(LCL) 손상 의심',moi:'varus',location:'outer',
  signals:['tenderness','swelling','instability_giving_way'],
  specialty:'정형외과',confirm:'무릎 바깥쪽 인대 압통과 내반 스트레스 검사'},
 {id:'lateral_meniscus',part:'knee',name:'외측 반월상연골 손상 의심',moi:'twist',location:'outer_joint_line',
  signals:['delayed_swelling','rom_limit','locking_catching','instability_giving_way'],
  specialty:'정형외과',confirm:'관절선 압통, 잠김 여부, McMurray 검사 등'},
 {id:'patellofemoral',part:'knee',name:'슬개대퇴 통증(연골연화증 등) 의심',moi:'repetitive',location:'front_patellar',
  signals:['recurring_swelling','crepitus_on_bend'],
  specialty:'정형외과·재활의학과',confirm:'슬개골 압박 검사와 하지 정렬 상태 확인'},
 {id:'patellar_tendinitis',part:'knee',name:'슬개건병증(슬개건 과사용 손상) 의심',moi:'jump_land',location:'below_patellar',
  signals:['localized_tenderness'],
  specialty:'정형외과·재활의학과',confirm:'슬개건 압통과 저항성 무릎 폄 검사'},
 {id:'osgood_schlatter',part:'knee',name:'오스굿-슐라터/라르센-요한슨 의심',moi:'run_jump_kneel',location:'below_patellar_tibial',
  signals:['swelling','localized_tenderness'],
  specialty:'정형외과·소아청소년과',confirm:'경골조면 압통과 성장판 상태 확인(성장기)'},
 {id:'patellar_rupture',part:'knee',name:'슬개건 파열 의심',moi:'forceful_kick',location:'below_patellar',
  signals:['sudden_severe_pain_swelling','cannot_extend'],urgent:true,
  specialty:'정형외과',confirm:'스스로 무릎 신전 가능 여부, 슬개골 위치 이상'},
 {id:'pcl',part:'knee',name:'후방십자인대(PCL) 손상 의심',moi:'fall_rotate',location:'back',
  signals:['pop_back','swelling'],urgent:true,
  specialty:'정형외과',confirm:'후방 전위(Posterior drawer) 등 전문 검사'},
 {id:'acl',part:'knee',name:'전방십자인대(ACL) 손상 의심',moi:'stop_hyperextend',location:'deep_whole',
  signals:['pop_snap','rapid_swelling','severe_pain'],urgent:true,
  specialty:'정형외과',confirm:'부종 발생 시점, 불안정성, Lachman 검사 등'},
];
const ANKLE_PATTERNS:PatternDef[] = [
 {id:'lateral_sprain',part:'ankle',name:'외측 발목 염좌 의심',moi:'inversion',location:'lateral_malleolus',
  signals:['pop_snap','swelling','bruise','instability_giving_way'],
  specialty:'정형외과·재활의학과',confirm:'외측 인대(전거비인대 등) 압통과 안정성 검사'},
 {id:'eversion_injury',part:'ankle',name:'내측 발목 염좌(Eversion injury) 의심',moi:'eversion',location:'medial_ankle',
  signals:['swelling','bruise'],
  specialty:'정형외과',confirm:'내측 삼각인대 압통과 안정성 검사'},
 {id:'syndesmotic',part:'ankle',name:'하이 앵클(경비인대결합) 염좌 의심',moi:'fixed_rotation',location:'front_upper_lateral',
  signals:['severe_pain','function_loss','pain_on_dorsiflexion'],urgent:true,
  specialty:'정형외과',confirm:'배굴·외회전 스트레스 검사, 경비인대결합 압통'},
 {id:'achilles_strain',part:'ankle',name:'아킬레스건 급성 긴장(strain) 의심',moi:'overstretch',location:'achilles_back',
  signals:['weakness'],
  specialty:'정형외과·재활의학과',confirm:'아킬레스건 압통과 저항성 발바닥 굽힘 검사'},
 {id:'achilles_tendinitis',part:'ankle',name:'아킬레스건염 의심',moi:'gradual',location:'achilles_back',
  signals:['morning_stiffness','general_pain','crepitus'],
  specialty:'정형외과·재활의학과',confirm:'만성 부하력과 건 비대·압통 확인'},
 {id:'achilles_rupture',part:'ankle',name:'아킬레스건 파열 의심',moi:'sudden_stopgo',location:'achilles_back',
  signals:['sudden_snap','immediate_pain','swelling_color_change','function_loss'],urgent:true,
  specialty:'정형외과',confirm:'Thompson 검사, 발뒤꿈치 들기 가능 여부'},
 {id:'fracture_dislocation',part:'ankle',name:'골절·탈구 가능성 배제 필요',moi:'high_impact',location:'whole_ankle',
  signals:['severe_pain','severe_swelling','function_status'],urgent:true,
  specialty:'정형외과 또는 응급실',confirm:'영상 검사(X-ray)로 골절·탈구 여부 확인'},
];

/* ===================== 상태 ===================== */
const empty = ():InjuryState => ({story:'',part:'',moi:'',location:'',signals:{},pain:0,redFlags:{deformity:'unknown',weightBearing:'unknown',sensation:'unknown',locking:'unknown'}});
let state=empty(), screen='home', recognition:SpeechRecognitionLike|null=null, isListening=false, stopVoice=false, finalTranscript='';
const root=document.querySelector<HTMLDivElement>('#app')!;
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]??c));
const go=(next:string)=>{screen=next;render();window.scrollTo({top:0,behavior:'smooth'});};
const toast=(message:string)=>{const el=document.querySelector('#toast');if(el){el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600);}};

/* ===================== 헬퍼 ===================== */
function partLabel():string{return state.part==='knee'?'무릎':state.part==='ankle'?'발목':'다친 부위';}
function optionLabel(list:Option[],id:string):string{return list.find(o=>o.id===id)?.label ?? id;}
function moiListFor(p:BodyPart):Option[]{return p==='knee'?KNEE_MOI:p==='ankle'?ANKLE_MOI:[];}
function locationListFor(p:BodyPart):Option[]{return p==='knee'?KNEE_LOCATION:p==='ankle'?ANKLE_LOCATION:[];}
function patternsFor(p:BodyPart):PatternDef[]{return p==='knee'?KNEE_PATTERNS:p==='ankle'?ANKLE_PATTERNS:[];}

function scorePattern(p:PatternDef):number{
 let s=0;
 if(p.moi===state.moi)s+=2;
 if(p.location===state.location)s+=2;
 for(const id of p.signals){
  const def=SIGNALS[id],ans=state.signals[id];
  if(!ans||ans==='unknown')continue;
  const positive=def.positiveOnNo?ans==='no':ans==='yes';
  s+=positive?2:-1;
 }
 return s;
}
function rankedPatterns():PatternDef[]{
 const list=patternsFor(state.part as BodyPart);
 return [...list].sort((a,b)=>scorePattern(b)-scorePattern(a));
}
function relevantSignals():SignalDef[]{
 const ids=new Set<string>();
 rankedPatterns().slice(0,3).forEach(p=>p.signals.forEach(id=>ids.add(id)));
 return [...ids].map(id=>SIGNALS[id]);
}
function moiLocationReason(p:PatternDef):string{
 const moiList=moiListFor(p.part),locList=locationListFor(p.part);
 const moiMatch=p.moi===state.moi,locMatch=p.location===state.location;
 if(moiMatch&&locMatch)return `입력하신 손상 상황(${optionLabel(moiList,p.moi)})과 통증 위치(${optionLabel(locList,p.location)})가 이 손상의 전형적인 조합과 일치합니다.`;
 if(moiMatch)return `입력하신 손상 상황(${optionLabel(moiList,p.moi)})이 이 손상에서 흔히 보이는 기전과 일치합니다.`;
 if(locMatch)return `통증 위치(${optionLabel(locList,p.location)})가 이 손상에서 흔히 나타나는 부위와 일치합니다.`;
 return '답변하신 신호들이 이 손상 패턴과 일부 겹칩니다.';
}

function assess():Assessment{
 const f=state.redFlags,urgentSignals:string[]=[];
 if(f.deformity==='yes')urgentSignals.push(`${partLabel()} 모양이 변했거나 뼈가 튀어나와 보임`);
 if(f.weightBearing==='yes')urgentSignals.push('체중을 거의 지지하지 못하거나 걷기가 불가능함');
 if(f.sensation==='yes')urgentSignals.push(`다친 ${partLabel()} 아래가 저리거나 감각이 둔하고, 차갑거나 창백함`);
 if(f.locking==='yes')urgentSignals.push('걸리거나 펴지지 않음(잠김)');

 const ranked=rankedPatterns();
 const top:PatternDef|undefined=ranked.length?ranked[0]:undefined;
 const patternUrgent=!!(top&&top.urgent&&scorePattern(top)>=6);

 const urgent=urgentSignals.length>0||state.pain>=9||patternUrgent;
 const watch=!urgent&&(state.pain>=6||f.weightBearing==='unknown'||/빠르게|심하게|뚝|충돌|점프|착지/.test(state.story));

 const candidates:Candidate[]=ranked.length
  ?ranked.slice(0,3).map(p=>{const sc=scorePattern(p);return {name:p.name,confidence:sc>=6?'높음':sc>=2?'중간':'낮음',reason:moiLocationReason(p),confirm:p.confirm};})
  :[{name:state.part==='knee'?'무릎 주변 근육·힘줄의 과사용 또는 타박상':'입력된 부위의 연부조직 손상',confidence:'낮음',reason:'현재 입력만으로는 특정 구조물을 확정하기 어렵습니다.',confirm:'통증 위치와 기능 변화를 기록하고 호전되지 않으면 진료를 받습니다.'}];
 while(candidates.length<3)candidates.push({name:'추가 확인이 필요한 손상',confidence:'낮음',reason:'현재 정보만으로는 다른 손상 가능성을 완전히 배제할 수 없습니다.',confirm:'통증과 기능 변화를 의료진에게 전달하세요.'});

 const severity:Severity=urgent?'urgent':watch?'watch':'mild';
 const specialty=urgent?(top?`${top.specialty} 또는 응급실`:'정형외과 또는 응급실'):(top?top.specialty:'정형외과·재활의학과 (통증 조절 중심이면 통증의학과)');
 return {
  severity,
  title:urgent?'지금은 병원 평가가 우선이에요':watch?'오늘 상태를 주의 깊게 관찰하세요':'현재는 초기 자가 관리부터 시작할 수 있어요',
  summary:urgent?'위험 신호가 있어 RICE만으로 지켜보면 안 됩니다.':watch?'경과를 기록하면서 48~72시간 안에 호전되는지 확인하세요.':'확정 진단은 아니지만, 현재 입력에서는 즉시 위험 신호가 확인되지 않았습니다.',
  candidates:candidates.slice(0,3),
  specialty,
  urgentSignals,
 };
}

/* ===================== 음성 입력 ===================== */
function startVoice(){const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech)return toast('이 브라우저는 음성 입력을 지원하지 않아요. 아래에 직접 입력해 주세요.');if(isListening)return toast('계속 듣고 있어요. 다 말했으면 아래 버튼을 눌러 주세요.');recognition=new Speech();recognition.lang='ko-KR';recognition.continuous=true;recognition.interimResults=true;stopVoice=false;recognition.onstart=()=>{isListening=true;render();};recognition.onresult=(event:SpeechRecognitionEventLike)=>{let interim='';for(let i=event.resultIndex;i<event.results.length;i++){const text=event.results[i][0].transcript;if(event.results[i].isFinal)finalTranscript+=text;else interim+=text;}state.story=finalTranscript+interim;updateStory();};recognition.onend=()=>{if(isListening&&!stopVoice){try{recognition?.start();}catch{/* already restarting */}}};recognition.onerror=(event:SpeechRecognitionErrorEventLike)=>{if(event.error==='not-allowed'){isListening=false;stopVoice=true;toast('마이크 권한을 허용해야 음성 입력을 사용할 수 있어요.');render();}};try{recognition.start();}catch{toast('음성 입력을 다시 눌러 주세요.');}}
function finishVoice(){stopVoice=true;isListening=false;recognition?.stop();finalTranscript=state.story;render();}
function updateStory(){const input=document.querySelector<HTMLTextAreaElement>('#story');if(input&&document.activeElement!==input)input.value=state.story;const status=document.querySelector('#voice-status');if(status)status.textContent=isListening?'듣는 중… 다 말했으면 아래 버튼을 눌러 주세요.':'상황을 짧게 말하거나 직접 입력해 주세요.';}

/* ===================== 공통 UI 조각 ===================== */
function choices(values:{id:string;label:string;icon:string}[],selected:string[],kind:string){return `<div class="choice-grid">${values.map(v=>`<button class="choice ${selected.includes(v.id)?'selected':''}" data-kind="${kind}" data-value="${v.id}"><span>${v.icon}</span><b>${v.label}</b></button>`).join('')}</div>`;}
function shell(content:string,progress=''){return `<header class="topbar"><a class="brand" href="#"><span class="brand-mark">A.T</span><span>나만의 A.T</span></a><a class="architecture-link" href="architecture.html">구조 보기 ↗</a></header><main class="shell">${progress?`<div class="progress"><span style="width:${progress}%"></span></div>`:''}${content}</main><div id="toast" class="toast" role="status"></div>`;}

/* ===================== 화면 ===================== */
function home(){return shell(`<section class="hero"><div class="hero-copy"><p class="eyebrow">선수와 보호자를 위한 스포츠 부상 가이드</p><h1>아픈 곳을 정확히 기록하고,<br><em>다음 행동</em>을 알 수 있게.</h1><p class="lead">다치신 상황(기전)과 통증 위치를 순서대로 골라 정확히 좁혀 드려요. 의료진에게 보여줄 기록과 24·48·72시간 경과 기준까지 한 번에 준비합니다.</p><button class="primary large" data-action="start">부상 기록 시작하기 <span>→</span></button><div class="trust"><span>✓ 확정 진단 아님</span><span>✓ 의료진 전달용 요약</span></div></div><div class="hero-art"><div class="orb"></div><img src="/assets/athlete-team-characters.png" alt="함께 운동하는 두 명의 선수 캐릭터"><div class="floating top">빠른 기록 <strong>1분</strong></div><div class="floating bottom">위험 신호 <strong>먼저 확인</strong></div></div></section>`);}
function intake(){return shell(`<section class="panel"><p class="eyebrow">01 · 상황 기록</p><h2>무슨 일이 있었는지<br><em>편하게 말해 주세요.</em></h2><p class="muted">정리된 문장보다 실제 상황이 더 좋아요. 말이 끊겨도 자동으로 끝나지 않아요.</p><div class="voice-box"><button class="voice" data-action="voice"><span class="mic">${isListening?'●':'⌕'}</span><b>${isListening?'듣는 중…':'눌러서 말하기'}</b><small id="voice-status">${isListening?'다 말했으면 아래 버튼을 눌러 주세요.':'예: 훈련 중 착지하다가 무릎 안쪽이 아파졌어요'}</small></button><button class="done" data-action="done" ${isListening?'':'disabled'}>다 말했음</button><textarea id="story" placeholder="또는 여기에 짧게 적어 주세요">${esc(state.story)}</textarea><div class="quick"><button data-action="story" data-value="달리다가 갑자기 아파졌어요">달리다가 아파짐</button><button data-action="story" data-value="점프 착지 후 아파졌어요">착지 후 아파짐</button><button data-action="story" data-value="부딪힌 뒤 붓고 아파요">충돌 후 붓기</button></div></div><div class="actions"><button class="text-button" data-action="home">처음으로</button><button class="primary" data-action="next-intake">다음 →</button></div></section>`,'15');}
function part(){return shell(`<section class="panel"><p class="eyebrow">02 · 부위 선택</p><h2>어느 부위가<br><em>불편한가요?</em></h2><p class="muted">부위를 고르면 다치신 상황(기전)부터 순서대로 확인해요.</p>${choices([{id:'knee',label:'무릎',icon:'🦵'},{id:'ankle',label:'발목',icon:'🦶'},{id:'other',label:'기타 부위',icon:'＋'}],state.part?[state.part]:[],'part')}<div class="actions"><button class="text-button" data-action="back-intake">← 이전</button><button class="primary" data-action="next-part">다음 →</button></div></section>`,'27');}
function moi(){const options=moiListFor(state.part as BodyPart),pl=partLabel();return shell(`<section class="panel"><p class="eyebrow">03 · 손상 기전</p><h2>${pl}을(를) 어떻게<br><em>다치셨나요?</em></h2><p class="muted">가장 비슷한 상황을 하나 골라 주세요. 기전을 알수록 더 정확하게 좁혀 드려요.</p>${choices(options,state.moi?[state.moi]:[],'moi')}<div class="actions"><button class="text-button" data-action="back-part">← 이전</button><button class="primary" data-action="next-moi">다음 →</button></div></section>`,'40');}
function location(){const options=locationListFor(state.part as BodyPart),pl=partLabel();return shell(`<section class="panel"><p class="eyebrow">04 · 통증 위치</p><h2>${pl} 중에서도<br><em>어디가 아픈가요?</em></h2><p class="muted">가장 가까운 위치를 하나 골라 주세요.</p>${choices(options,state.location?[state.location]:[],'location')}<div class="actions"><button class="text-button" data-action="back-moi">← 이전</button><button class="primary" data-action="next-location">다음 →</button></div></section>`,'53');}
function signalsScreen(){
 const defs=relevantSignals();
 const groups:{cat:SignalCategory;label:string;icon:string}[]=[{cat:'external',label:'겉으로 보이는 신호',icon:'👁'},{cat:'internal',label:'느껴지는 신호',icon:'❗'},{cat:'function',label:'움직임·기능',icon:'🏃'}];
 const body=groups.map(g=>{
  const items=defs.filter(d=>d.category===g.cat);
  if(!items.length)return '';
  return `<div class="question"><h3>${g.icon} ${g.label}</h3><div class="safety-list">${items.map(item=>`<div class="safety-row"><span class="safety-icon">${g.icon}</span><div><b>${item.label}</b></div><div class="segmented">${(['no','unknown','yes'] as Choice[]).map(v=>`<button class="${state.signals[item.id]===v?'selected':''}" data-action="signal" data-key="${item.id}" data-value="${v}">${v==='yes'?'네':v==='no'?'아니요':'모르겠어요'}</button>`).join('')}</div></div>`).join('')}</div>`;
 }).join('');
 return shell(`<section class="panel"><p class="eyebrow">05 · 구별 질문</p><h2>몇 가지만 더<br><em>구체적으로 확인할게요.</em></h2><p class="muted">앞서 고르신 기전·위치와 관련해 꼭 필요한 것만 물어볼게요.</p>${body||'<p class="muted">추가로 확인할 신호가 없어요. 다음으로 진행해 주세요.</p>'}<div class="actions"><button class="text-button" data-action="back-location">← 이전</button><button class="primary" data-action="next-signals">위험 신호 확인 →</button></div></section>`,'66');
}
function safety(){const pl=partLabel();const labels=[{key:'deformity',icon:'⚠',title:`${pl} 모양이 변했거나 심하게 부었나요?`,hint:'뼈가 튀어나오거나 빠르게 커지는 부종'},{key:'weightBearing',icon:'🚶',title:'체중을 싣고 걸을 수 있나요?',hint:'거의 못 걷거나 계속 꺾이는 느낌이 있는 경우'},{key:'sensation',icon:'◌',title:`다친 ${pl} 아래가 저리거나 차가운가요?`,hint:'발가락·발끝 저림·감각 저하·차가움·창백함'},{key:'locking',icon:'▣',title:`${pl}이 걸려 펴지지 않나요?`,hint:'잠김이 생겨 굽히거나 펴기 어려운 경우'}];return shell(`<section class="panel"><p class="eyebrow">06 · 위험 신호 먼저 확인</p><h2>지금 바로 병원에 갈<br><em>신호가 있는지 봐요.</em></h2><p class="muted">모호하게 “상태가 나쁘면”이 아니라, 행동 기준으로 안내할게요.</p><div class="safety-list">${labels.map(item=>`<div class="safety-row"><span class="safety-icon">${item.icon}</span><div><b>${item.title}</b><small>${item.hint}</small></div><div class="segmented">${(['no','unknown','yes'] as Choice[]).map(v=>`<button class="${state.redFlags[item.key as keyof InjuryState['redFlags']]===v?'selected':''}" data-action="flag" data-key="${item.key}" data-value="${v}">${v==='yes'?'있어요':v==='no'?'없어요':'모르겠어요'}</button>`).join('')}</div></div>`).join('')}</div><div class="actions"><button class="text-button" data-action="back-safety">← 이전</button><button class="primary" data-action="next-safety">통증 정도 입력 →</button></div></section>`,'79');}
function pain(){return shell(`<section class="panel compact"><p class="eyebrow">07 · 통증 기록</p><h2>지금 통증은<br><em>어느 정도인가요?</em></h2><p class="muted">0은 통증 없음, 10은 참기 힘든 가장 심한 통증이에요.</p><div class="pain-grid">${[1,3,5,7,9].map(n=>`<button class="pain ${state.pain===n?'selected':''}" data-action="pain" data-value="${n}"><strong>${n}</strong><span>${n<=3?'가벼움':n<=5?'불편함':n<=7?'많이 아픔':'매우 아픔'}</span></button>`).join('')}</div><div class="actions"><button class="text-button" data-action="back-safety">← 이전</button><button class="primary" data-action="result">내 결과 보기 →</button></div></section>`,'90');}
function exerciseBlock():string{if(state.part==='ankle')return `<div class="exercise"><b>통증이 날카롭지 않고 심한 불안정감이 없을 때만</b><p>발목으로 알파벳을 그리듯 통증이 없는 범위에서 천천히 움직이기를 10회, 하루 2~3세트. 통증이 증가하면 중단하세요.</p></div>`;if(state.part==='knee')return `<div class="exercise"><b>통증이 날카롭지 않고 잠김·불안정성이 없을 때만</b><p>무릎을 편 채 허벅지 앞에 힘을 주고 5초 유지 → 10회, 하루 2~3세트. 통증이 증가하면 중단하세요.</p></div>`;return '';}
function rice(a:Assessment){if(a.severity==='urgent')return `<div class="urgent-box"><b>지금은 자가 처치보다 진료가 먼저예요</b><p>다친 부위를 억지로 펴거나 맞추지 말고, 운동을 중단한 채 보호자·코치와 함께 정형외과 또는 응급실로 이동하세요.</p></div>`;return `<div class="rice"><div><span>①</span><b>Rest · 쉬기</b><p>운동을 멈추고 체중 부하를 줄여요. 통증이 나는 동작·달리기·점프는 중단하세요.</p></div><div><span>②</span><b>Ice · 냉찜질</b><p>수건으로 감싼 얼음팩을 15~20분, 하루 3~5회. 피부에 직접 대지 않아요.</p></div><div><span>③</span><b>Compression · 압박</b><p>붕대를 아래에서 위로 편하게 감아요. 저림·창백함·통증 증가 시 즉시 풀어요.</p></div><div><span>④</span><b>Elevation · 올리기</b><p>누워서 다친 부위를 심장보다 높게 받쳐 부종을 줄여요.</p></div></div>${exerciseBlock()}`;}
function result(){const a=assess(),label=a.severity==='urgent'?'심각':a.severity==='watch'?'주의':'경미';return shell(`<section class="result"><div class="result-top ${a.severity}"><span class="status-icon">${a.severity==='urgent'?'!':a.severity==='watch'?'◐':'✓'}</span><div><p class="eyebrow">평가 결과 · ${label}</p><h2>${a.title}</h2><p>${a.summary}</p></div></div><div class="timeline"><div><b>지금</b><span>운동 중단<br>상태 기록</span></div><div><b>24시간</b><span>통증·부종<br>변화 확인</span></div><div class="active"><b>48시간</b><span>호전 없으면<br>진료 전환</span></div><div><b>72시간</b><span>지속·악화 시<br>병원 방문</span></div></div><div class="result-grid"><article class="card candidates"><div class="card-head"><span>01</span><h3>예상 부상 후보</h3></div>${a.candidates.map((c,i)=>`<div class="candidate"><div class="rank">${i+1}</div><div><b>${c.name}</b><em>${c.confidence}</em><p>${c.reason}</p><small>진료에서 확인: ${c.confirm}</small></div></div>`).join('')}</article><article class="card"><div class="card-head"><span>02</span><h3>지금 당장 할 처치</h3></div>${rice(a)}</article><article class="card warning"><div class="card-head"><span>03</span><h3>이럴 땐 바로 병원 가세요</h3></div><ul>${a.urgentSignals.length?a.urgentSignals.map(s=>`<li>${s}</li>`).join(''):'<li><b>48~72시간</b> RICE 후에도 통증·부종이 줄지 않거나 더 심해질 때</li><li>체중을 싣기 힘들어지거나 갑자기 힘이 빠지거나 덜컥 빠지는 느낌이 새로 생길 때</li><li>발가락·발끝 저림·감각 저하·차가워지거나 창백해질 때</li><li>걸려서 펴지지도 굽혀지지도 않을 때</li>'}</ul><div class="specialty"><b>권장 진료과</b><span>${a.specialty}</span><small>응급 신호는 예약을 기다리지 말고 즉시 진료받으세요.</small></div></article></div><div class="result-actions"><button class="primary" data-action="report">의료진 전달용 요약 만들기</button><button class="secondary" data-action="restart">새 기록 시작</button></div><p class="disclaimer">본 결과는 의료진의 진단을 대체하지 않는 보조적 참고 안내입니다. 15세 이하 사용자는 보호자·코치에게 즉시 공유하세요.</p></section>`);}
function report(){
 const a=assess(),pl=partLabel();
 const hasDetail=state.part==='knee'||state.part==='ankle';
 const moiLabel=hasDetail?optionLabel(moiListFor(state.part as BodyPart),state.moi):'';
 const locLabel=hasDetail?optionLabel(locationListFor(state.part as BodyPart),state.location):'';
 return shell(`<section class="panel report"><p class="eyebrow">의료진 전달용 요약</p><h2>진료 전에 이 화면을<br><em>보여 주세요.</em></h2><div class="report-card"><div class="report-brand"><span class="brand-mark">A.T</span><b>나만의 A.T 부상 기록</b></div><div><small>상황</small><b>${esc(state.story||'상황 미입력')}</b></div><div><small>부위</small><b>${pl}</b></div>${hasDetail?`<div><small>손상 기전</small><b>${moiLabel}</b></div><div><small>통증 위치</small><b>${locLabel}</b></div>`:''}<div><small>통증 / 위험도</small><b>${state.pain}/10 · ${a.severity==='urgent'?'심각':a.severity==='watch'?'주의':'경미'}</b></div><div><small>우선 감별 후보</small><b>${a.candidates.map(c=>c.name).join(' / ')}</b></div></div><button class="primary full" data-action="copy">요약 내용 복사하기</button><button class="text-button full" data-action="back-result">← 결과로 돌아가기</button></section>`,'100');
}

/* ===================== 렌더 & 이벤트 바인딩 ===================== */
function render(){
 root.innerHTML=screen==='home'?home()
  :screen==='intake'?intake()
  :screen==='part'?part()
  :screen==='moi'?moi()
  :screen==='location'?location()
  :screen==='signals'?signalsScreen()
  :screen==='safety'?safety()
  :screen==='pain'?pain()
  :screen==='result'?result()
  :report();
 bind();
}
function bind(){
 root.querySelectorAll<HTMLElement>('[data-action]').forEach(el=>el.addEventListener('click',()=>{
  const a=el.dataset.action;
  if(a==='start')go('intake');
  if(a==='home'||a==='restart'){state=empty();finalTranscript='';go('home');}
  if(a==='voice')startVoice();
  if(a==='done')finishVoice();
  if(a==='story'){state.story=el.dataset.value??'';finalTranscript=state.story;render();}
  if(a==='next-intake'){const input=document.querySelector<HTMLTextAreaElement>('#story');state.story=input?.value.trim()||state.story;go('part');}
  if(a==='back-intake')go('intake');
  if(a==='next-part'){if(!state.part)return toast('먼저 부위를 선택해 주세요.');go(state.part==='other'?'safety':'moi');}
  if(a==='back-part')go('part');
  if(a==='next-moi'){if(!state.moi)return toast('가장 비슷한 상황을 하나 선택해 주세요.');go('location');}
  if(a==='back-moi')go('moi');
  if(a==='next-location'){if(!state.location)return toast('통증 위치를 하나 선택해 주세요.');go('signals');}
  if(a==='back-location')go('location');
  if(a==='next-signals')go('safety');
  if(a==='back-signals')go('signals');
  if(a==='next-safety')go('pain');
  if(a==='back-safety')go(state.part==='other'?'part':'signals');
  if(a==='result')state.pain?go('result'):toast('통증 정도를 선택해 주세요.');
  if(a==='report')go('report');
  if(a==='back-result')go('result');
  if(a==='signal'){const key=el.dataset.key;if(key)state.signals[key]=el.dataset.value as Choice;render();}
  if(a==='flag'){state.redFlags[el.dataset.key as keyof InjuryState['redFlags']]=el.dataset.value as Choice;render();}
  if(a==='pain'){state.pain=Number(el.dataset.value);render();}
  if(a==='copy'){navigator.clipboard?.writeText(document.querySelector('.report-card')?.textContent??'');toast('요약을 복사했어요.');}
 }));
 root.querySelectorAll<HTMLTextAreaElement>('#story').forEach(el=>el.addEventListener('input',()=>{state.story=el.value;finalTranscript=el.value;}));
 root.querySelectorAll<HTMLElement>('[data-kind="part"]').forEach(el=>el.addEventListener('click',()=>{state.part=el.dataset.value as BodyPart;state.moi='';state.location='';state.signals={};render();}));
 root.querySelectorAll<HTMLElement>('[data-kind="moi"]').forEach(el=>el.addEventListener('click',()=>{state.moi=el.dataset.value??'';render();}));
 root.querySelectorAll<HTMLElement>('[data-kind="location"]').forEach(el=>el.addEventListener('click',()=>{state.location=el.dataset.value??'';render();}));
}
declare global{interface Window{SpeechRecognition?:SpeechRecognitionConstructor;webkitSpeechRecognition?:SpeechRecognitionConstructor}}
render();
