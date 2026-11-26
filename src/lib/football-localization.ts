const teamTranslations = {
  "Manchester City": "曼城", "Manchester United": "曼联", Arsenal: "阿森纳", Liverpool: "利物浦",
  Chelsea: "切尔西", "Aston Villa": "阿斯顿维拉", Bournemouth: "伯恩茅斯", Brentford: "布伦特福德",
  "Brighton and Hove Albion": "布莱顿", "Coventry City": "考文垂城", "Crystal Palace": "水晶宫",
  Everton: "埃弗顿", Fulham: "富勒姆", "Tottenham Hotspur": "托特纳姆热刺", "Newcastle United": "纽卡斯尔联",
  Sunderland: "桑德兰", "Leeds United": "利兹联", "Nottingham Forest": "诺丁汉森林", "Ipswich Town": "伊普斯维奇",
  "Hull City": "赫尔城", Wolverhampton: "伍尔弗汉普顿流浪者", Blackburn: "布莱克本流浪者",
  "Birmingham City FC": "伯明翰", "Bolton Wanderers FC": "博尔顿", "Bristol City FC": "布里斯托尔城",
  "Burnley FC": "伯恩利", "Cardiff City FC": "卡迪夫城", "Derby County FC": "德比郡",
  "Lincoln City FC": "林肯城", "Middlesbrough FC": "米德尔斯堡", "Millwall FC": "米尔沃尔",
  "Norwich City FC": "诺维奇", "Portsmouth FC": "朴茨茅斯", "Preston North End FC": "普雷斯顿",
  "Sheffield United FC": "谢菲尔德联", "Southampton FC": "南安普顿", "Stoke City FC": "斯托克城",
  "Swansea City AFC": "斯旺西", "Watford FC": "沃特福德", "West Bromwich Albion FC": "西布罗姆维奇",
  "West Ham United FC": "西汉姆联", "Wrexham AFC": "雷克瑟姆", "Brighton & Hove Albion FC": "布莱顿",
  "Real Madrid": "皇家马德里", Barcelona: "巴塞罗那", "Atletico Madrid": "马德里竞技", "Atlético Madrid": "马德里竞技",
  "Athletic Club": "毕尔巴鄂竞技", "Athletic Bilbao": "毕尔巴鄂竞技", Sevilla: "塞维利亚", Valencia: "瓦伦西亚",
  Villarreal: "比利亚雷亚尔", Getafe: "赫塔费", "Real Sociedad": "皇家社会", "Celta Vigo": "塞尔塔",
  Espanyol: "西班牙人", Osasuna: "奥萨苏纳", Levante: "莱万特", Elche: "埃尔切", Alaves: "阿拉维斯",
  "Deportivo La Coruna": "拉科鲁尼亚", Malaga: "马拉加", "Rayo Vallecano": "巴列卡诺",
  "Deportivo de A Coruña": "拉科鲁尼亚",
  "Club Atlético de Madrid": "马德里竞技", "RC Celta de Vigo": "塞尔塔", "Real Betis Balompié": "皇家贝蒂斯",
  "Real Racing Club de Santander": "桑坦德竞技",
  "Bayern Munich": "拜仁慕尼黑", "Borussia Dortmund": "多特蒙德", "Bayer Leverkusen": "勒沃库森",
  "Borussia Monchengladbach": "门兴格拉德巴赫", "Eintracht Frankfurt": "法兰克福", Freiburg: "弗赖堡",
  Hoffenheim: "霍芬海姆", Augsburg: "奥格斯堡", Hamburg: "汉堡", Leipzig: "莱比锡", Schalke: "沙尔克04",
  "Werder Bremen": "云达不来梅", Elversberg: "埃尔弗斯贝格",
  "1. FC Köln": "科隆", "1. FC Union Berlin": "柏林联合", "1. FSV Mainz 05": "美因茨",
  "Bayer 04 Leverkusen": "勒沃库森", "FC Bayern München": "拜仁慕尼黑", "SC Paderborn 07": "帕德博恩",
  "VfB Stuttgart": "斯图加特",
  "AC Milan": "AC米兰", "Inter Milan": "国际米兰", Juventus: "尤文图斯", Napoli: "那不勒斯",
  "AS Roma": "罗马", Atalanta: "亚特兰大", Bologna: "博洛尼亚", Cagliari: "卡利亚里",
  Como: "科莫", Fiorentina: "佛罗伦萨", Frosinone: "弗罗西诺内", Genoa: "热那亚", Lazio: "拉齐奥",
  Lecce: "莱切", Parma: "帕尔马", Sassuolo: "萨索洛", Torino: "都灵",
  "AC Monza": "蒙扎", "FC Internazionale Milano": "国际米兰", "Udinese Calcio": "乌迪内斯", "Venezia FC": "威尼斯",
  "Paris Saint-Germain": "巴黎圣日耳曼", PSG: "巴黎圣日耳曼", Marseille: "马赛", Lyon: "里昂",
  Monaco: "摩纳哥", Lille: "里尔", Lens: "朗斯", Brest: "布雷斯特", Lorient: "洛里昂",
  "Le Havre": "勒阿弗尔", Angers: "昂热", Auxerre: "欧塞尔", Rennes: "雷恩", Toulouse: "图卢兹",
  Nice: "尼斯", "Le Mans": "勒芒", Troyes: "特鲁瓦",
  "RC Strasbourg Alsace": "斯特拉斯堡", "Stade Rennais FC 1901": "雷恩",
  Ajax: "阿贾克斯", PSV: "埃因霍温", Feyenoord: "费耶诺德", "AZ Alkmaar": "阿尔克马尔",
  "PSV Eindhoven": "埃因霍温",
  Utrecht: "乌德勒支", Groningen: "格罗宁根", Heerenveen: "海伦芬", "Sparta Rotterdam": "鹿特丹斯巴达",
  "Go Ahead Eagles": "前进之鹰", "Fortuna Sittard": "福图纳锡塔德", Excelsior: "SBV精英",
  Cambuur: "坎布尔", "ADO Den Haag": "海牙", Twente: "特温特", Zwolle: "兹沃勒",
  NEC: "奈梅亨", "Telstar 1963": "特尔斯达", "Willem II Tilburg": "威廉二世",
  Benfica: "本菲卡", Porto: "波尔图", "Sporting CP": "葡萄牙体育", Braga: "布拉加",
  "Académico de Viseu FC": "维塞乌学院", "Casa Pia AC": "卡萨皮亚", "CD Nacional": "马德拉国民",
  "CD Santa Clara": "圣克拉拉", "CF Estrela da Amadora": "阿马多拉之星", "CS Marítimo": "马里迪莫",
  "FC Alverca": "阿维卡", "FC Arouca": "阿罗卡", "FC Famalicão": "法马利康",
  "GD Estoril Praia": "埃斯托里尔", "Gil Vicente FC": "吉尔维森特", "Moreirense FC": "莫雷拉人",
  "Rio Ave FC": "阿维河", "Vitória SC": "吉马良斯",
  "Botafogo FR": "博塔弗戈", "CA Mineiro": "米涅罗竞技", "CA Paranaense": "巴拉那竞技",
  "CA Platense": "普拉滕斯", "CA Rosario Central": "罗萨里奥中央", "CAR Independiente del Valle": "山谷独立",
  "CD Coquimbo Unido": "科金博联合", "CD Tolima": "托利马体育", "CD Universidad Católica": "天主大学",
  "Chapecoense AF": "沙佩科恩斯", "Club Cerro Porteño": "波特诺山丘", "Clube do Remo": "瑞模贝雷",
  "Coritiba FBC": "科里蒂巴", "CR Flamengo": "弗拉门戈", "CR Vasco da Gama": "瓦斯科达伽马",
  "Cruzeiro EC": "克鲁塞罗", "CS Independiente Rivadavia": "门多萨独立", "EC Bahia": "巴伊亚",
  "EC Vitória": "维多利亚", "Estudiantes de La Plata": "拉普拉塔大学生", "Fluminense FC": "弗鲁米嫩塞",
  "Grêmio FBPA": "格雷米奥", "LDU de Quito": "基多体育大学", "Mirassol FC": "米拉索尔",
  "Santos FC": "桑托斯", "São Paulo FC": "圣保罗", "SC Corinthians Paulista": "科林蒂安",
  "SC Internacional": "巴西国际", "SE Palmeiras": "帕尔梅拉斯",
  "Al Hilal": "利雅得新月", "Al Nassr": "利雅得胜利", "Al Ittihad": "吉达联合", "Al Ahli": "吉达国民",
  "Shanghai Port": "上海海港", "Shanghai Shenhua": "上海申花", "Shandong Taishan": "山东泰山",
  "Beijing Guoan": "北京国安", "Chengdu Rongcheng": "成都蓉城", "Wuhan Three Towns": "武汉三镇",
  "Inter Miami": "迈阿密国际", "LA Galaxy": "洛杉矶银河", "Los Angeles FC": "洛杉矶FC",
  "Vissel Kobe": "神户胜利船", "Urawa Red Diamonds": "浦和红钻", "Yokohama F. Marinos": "横滨水手",
  "Ulsan HD": "蔚山HD", "Jeonbuk Hyundai Motors": "全北现代汽车",
  Argentina: "阿根廷", Australia: "澳大利亚", Belgium: "比利时", Brazil: "巴西", China: "中国",
  Colombia: "哥伦比亚", Croatia: "克罗地亚", England: "英格兰", France: "法国", Germany: "德国",
  Iran: "伊朗", Italy: "意大利", Japan: "日本", Mexico: "墨西哥", Morocco: "摩洛哥",
  Netherlands: "荷兰", Portugal: "葡萄牙", Senegal: "塞内加尔", "South Korea": "韩国", Spain: "西班牙",
  Uruguay: "乌拉圭", "United States": "美国", "United States U17": "美国U17"
} as const;

const termTranslations: Record<string, string> = {
  England: "英格兰", Spain: "西班牙", Germany: "德国", Italy: "意大利", France: "法国", Portugal: "葡萄牙",
  Netherlands: "荷兰", China: "中国", Japan: "日本", "South Korea": "韩国", "Saudi Arabia": "沙特阿拉伯",
  "United States": "美国", Argentina: "阿根廷", Brazil: "巴西", Belgium: "比利时", Morocco: "摩洛哥",
  Europe: "欧洲", Asia: "亚洲", Africa: "非洲", "South America": "南美洲", "North America": "北美洲",
  Club: "俱乐部", "National Team": "国家队", "Top Tier": "顶级", Competitive: "竞争级", "First Team": "一线",
  "English Premier League": "英格兰足球超级联赛", "Premier League": "英超", Championship: "英冠",
  "La Liga": "西班牙足球甲级联赛", Bundesliga: "德国足球甲级联赛", "Serie A": "意大利足球甲级联赛",
  "Ligue 1": "法国足球甲级联赛", Eredivisie: "荷兰足球甲级联赛", "Primeira Liga": "葡萄牙足球超级联赛",
  "Chinese Super League": "中国足球超级联赛", "Saudi Pro League": "沙特职业足球联赛",
  "Major League Soccer": "美国职业足球大联盟", MLS: "美国职业足球大联盟",
  "UEFA Champions League": "欧洲冠军联赛", "Copa Libertadores": "南美解放者杯",
  "FIFA World Cup": "国际足联世界杯", "World Cup Qualifying AFC": "世界杯亚洲区预选赛",
  "World Cup Qualifying UEFA": "世界杯欧洲区预选赛",
  Forward: "前锋", Striker: "前锋", Winger: "边锋", Midfielder: "中场", "Defensive Midfielder": "防守型中场",
  Defender: "后卫", "Centre-Back": "中后卫", "Center-Back": "中后卫", "Full-Back": "边后卫",
  Goalkeeper: "门将", Coach: "教练", Manager: "主教练",
  SCHEDULED: "已排期", TIMED: "时间已确定", NS: "未开始", LIVE: "进行中", FT: "已结束",
  REGULAR_SEASON: "常规赛", PLAY_OFFS: "淘汰赛", "Matchday": "比赛轮次"
};

const playerTranslations: Record<string, string> = {
  "Erling Haaland": "埃尔林·哈兰德", "Kevin De Bruyne": "凯文·德布劳内", "Phil Foden": "菲尔·福登",
  "Abdukodir Khusanov": "阿布杜科迪尔·胡萨诺夫", "Antoine Semenyo": "安托万·塞梅诺", "Claudio Echeverri": "克劳迪奥·埃切维里",
  "Elliot Anderson": "埃利奥特·安德森", "Issa Kaboré": "伊萨·卡博雷", "Issa Kabore": "伊萨·卡博雷",
  "Kylian Mbappe": "基利安·姆巴佩", "Kylian Mbappé": "基利安·姆巴佩", "Vinicius Junior": "维尼修斯·儒尼奥尔",
  "Vinícius Júnior": "维尼修斯·儒尼奥尔", "Jude Bellingham": "裘德·贝林厄姆", "Mohamed Salah": "穆罕默德·萨拉赫",
  "Virgil van Dijk": "维吉尔·范戴克", "Bukayo Saka": "布卡约·萨卡", "Martin Odegaard": "马丁·厄德高",
  "Martin Ødegaard": "马丁·厄德高", "Lionel Messi": "利昂内尔·梅西", "Cristiano Ronaldo": "克里斯蒂亚诺·罗纳尔多",
  "Harry Kane": "哈里·凯恩", "Robert Lewandowski": "罗伯特·莱万多夫斯基", "Lamine Yamal": "拉明·亚马尔",
  "Ousmane Dembele": "奥斯曼·登贝莱", "Ousmane Dembélé": "奥斯曼·登贝莱", "Gianluigi Donnarumma": "吉安路易吉·多纳鲁马",
  "Álvaro Carreras": "阿尔瓦罗·卡雷拉斯", "Andriy Lunin": "安德烈·卢宁", "Antonio Rüdiger": "安东尼奥·吕迪格",
  "Arda Güler": "阿尔达·居莱尔", "Aurélien Tchouaméni": "奥雷利安·楚阿梅尼", "Bernardo Silva": "贝尔纳多·席尔瓦",
  "Brahim Díaz": "布拉欣·迪亚斯", "Ben White": "本·怀特", "Christian Nørgaard": "克里斯蒂安·诺尔高",
  "Cristhian Mosquera": "克里斯蒂安·莫斯克拉", "David Raya": "戴维·拉亚", "Declan Rice": "德克兰·赖斯",
  "Eberechi Eze": "埃贝雷奇·埃泽", "Ethan Nwaneri": "伊桑·恩瓦内里", "Fábio Vieira": "法比奥·维埃拉",
  "Alexander Isak": "亚历山大·伊萨克", "Alexis Mac Allister": "亚历克西斯·麦卡利斯特", "Alisson Becker": "阿利松·贝克尔",
  "Conor Bradley": "康纳·布拉德利", "Cody Gakpo": "科迪·加克波", "Curtis Jones": "柯蒂斯·琼斯",
  "Dominik Szoboszlai": "多米尼克·索博斯洛伊", "Federico Chiesa": "费代里科·基耶萨", "Aleksandar Pavlović": "亚历山大·帕夫洛维奇",
  "Alphonso Davies": "阿方索·戴维斯", "Dayot Upamecano": "达约特·乌帕梅卡诺", "Hiroki Itō": "伊藤洋辉",
  "Jamal Musiala": "贾马尔·穆西亚拉", "João Palhinha": "若昂·帕利尼亚", "Jonas Urbig": "约纳斯·乌尔比希",
  "Alessandro Bastoni": "亚历山德罗·巴斯托尼", "Davide Frattesi": "达维德·弗拉泰西", "Federico Dimarco": "费德里科·迪马尔科",
  "Francesco Acerbi": "弗朗切斯科·阿切尔比", "Hakan Çalhanoğlu": "哈坎·恰尔汗奥卢",
  "Alejandro Balde": "亚历杭德罗·巴尔德", "Andreas Christensen": "安德烈亚斯·克里斯滕森", "Dani Olmo": "达尼·奥尔莫",
  "Eric García": "埃里克·加西亚", "Fermín López": "费尔明·洛佩斯", "Ferran Torres": "费兰·托雷斯",
  "Frenkie de Jong": "弗伦基·德容", Gavi: "加维", "Gerard Martín": "赫拉德·马丁"
};

function normalized(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(fc|cf|afc|club|football|futbol|calcio|1907|1909|1913)\b/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "").trim();
}

const normalizedTeams = new Map(Object.entries(teamTranslations).map(([name, translation]) => [normalized(name), translation]));
const normalizedTeamEntries = [...normalizedTeams.entries()].sort((left, right) => right[0].length - left[0].length);
const reversedTerms = new Map(Object.entries(termTranslations).map(([english, chinese]) => [chinese, english]));
const chineseTermFallbacks: Record<string, string> = {
  英超: "Premier League", 西甲: "La Liga", 德甲: "Bundesliga", 意甲: "Serie A", 法甲: "Ligue 1",
  中超: "Chinese Super League", 中超联赛: "Chinese Super League", 沙特联: "Saudi Pro League", 沙特职业联赛: "Saudi Pro League",
  美职联: "Major League Soccer", 欧冠: "UEFA Champions League", 荷甲: "Eredivisie", 葡超: "Primeira Liga",
  国家队: "National Team", 俱乐部: "Club", 顶级: "Top Tier", 竞争级: "Competitive", 一线: "First Team",
  欧洲: "Europe", 亚洲: "Asia", 非洲: "Africa", 南美洲: "South America", 北美洲: "North America"
};

function containsChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

export function chineseTeamName(name: string) {
  if (!name.trim() || containsChinese(name)) return "";
  const key = normalized(name);
  const exact = normalizedTeams.get(key);
  if (exact) return exact;
  const partial = normalizedTeamEntries.find(([candidate]) => candidate.length >= 4 && (key.includes(candidate) || candidate.includes(key)));
  return partial?.[1] ?? "中文译名待补充";
}

export function chinesePlayerName(name: string, verifiedTranslation = "") {
  if (!name.trim()) return "";
  if (containsChinese(name)) {
    const generated: Record<string, string> = {
      核心前锋: "Key Forward", 组织中场: "Playmaking Midfielder", 防守中场: "Defensive Midfielder",
      中后卫: "Centre-Back", 门将: "Goalkeeper"
    };
    return generated[name] ?? "";
  }
  if (playerTranslations[name]) return playerTranslations[name];
  const supplied = verifiedTranslation.trim();
  if (containsChinese(supplied)) return supplied;
  const role = ["Defensive Midfielder", "Goalkeeper", "Midfielder", "Defender", "Forward"]
    .find((candidate) => name.endsWith(` ${candidate}`));
  if (role) {
    const team = name.slice(0, -(role.length + 1));
    const translatedTeam = chineseTeamName(team);
    return `${translatedTeam === "中文译名待补充" ? team : translatedTeam} · ${termTranslations[role]}`;
  }
  return "";
}

export function bilingualTerm(value: string) {
  if (!value.trim()) return "";
  if (containsChinese(value)) return reversedTerms.get(value) ?? chineseTermFallbacks[value] ?? "";
  return termTranslations[value] ?? "";
}
