const { getDb } = require('./config/db');

async function testDailyGames() {
    try {
        const db = getDb();
        const collection = db.collection('daily-games');
        
        // 오늘 날짜
        const today = new Date();
        const date = today.getFullYear().toString() +
                    (today.getMonth() + 1).toString().padStart(2, '0') +
                    today.getDate().toString().padStart(2, '0');
        
        console.log('=== Daily-Games 데이터베이스 테스트 ===');
        console.log('조회 날짜:', date);
        
        // 특정 날짜 데이터 조회
        const games = await collection.findOne({ date });
        
        if (games) {
            console.log('\n✅ 데이터 발견');
            console.log('전체 데이터:', JSON.stringify(games, null, 2));
            
            console.log('\n📊 경기별 상세 정보:');
            games.games.forEach((game, index) => {
                console.log(`\n경기 ${index + 1}:`);
                console.log(`  - 번호: ${game.number}`);
                console.log(`  - 홈팀: ${game.homeTeam}`);
                console.log(`  - 원정팀: ${game.awayTeam}`);
                console.log(`  - 시작시간: ${game.startTime}`);
                console.log(`  - 종료시간: ${game.endTime}`);
                console.log(`  - 경기상황: ${game.noGame}`);
                console.log(`  - 활성상태: ${game.isActive}`);
            });
        } else {
            console.log('\n❌ 해당 날짜의 데이터가 없습니다.');
        }
        
        // 전체 콜렉션 데이터 확인
        console.log('\n=== 전체 콜렉션 데이터 ===');
        const allData = await collection.find({}).toArray();
        console.log(`총 ${allData.length}개의 날짜 데이터가 있습니다.`);
        
        allData.forEach((data, index) => {
            console.log(`\n날짜 ${index + 1}: ${data.date}`);
            console.log(`경기 수: ${data.games ? data.games.length : 0}`);
            if (data.games) {
                data.games.forEach(game => {
                    console.log(`  - 경기 ${game.number}: ${game.homeTeam} vs ${game.awayTeam} (${game.noGame})`);
                });
            }
        });
        
    } catch (error) {
        console.error('테스트 오류:', error);
    } finally {
        process.exit(0);
    }
}

testDailyGames(); 