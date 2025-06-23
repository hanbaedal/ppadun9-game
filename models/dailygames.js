// MongoDB 네이티브 클라이언트 사용
// mongoose 대신 기존 방식과 동일하게 구현

class DailyGamesModel {
    constructor(db) {
        this.db = db;
        this.collection = db.collection('dailygames');
    }

    // CREATE - 새로운 일일 경기 데이터 생성
    async create(date, games) {
        try {
            // 기존 데이터가 있는지 확인
            const existingData = await this.collection.findOne({ date });
            if (existingData) {
                throw new Error('해당 날짜의 데이터가 이미 존재합니다.');
            }

            // 5개 경기 데이터 생성
            const gameData = [];
            for (let i = 1; i <= 5; i++) {
                const game = games.find(g => g.number === i) || {
                    number: i,
                    homeTeam: null,
                    awayTeam: null,
                    startTime: null,
                    endTime: null,
                    status: '정상게임'
                };
                gameData.push(game);
            }

            const dailyGames = {
                date,
                games: gameData,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await this.collection.insertOne(dailyGames);
            return { ...dailyGames, _id: result.insertedId };
        } catch (error) {
            throw error;
        }
    }

    // READ - 특정 날짜의 경기 데이터 조회
    async findByDate(date) {
        try {
            const dailyGames = await this.collection.findOne({ date });
            return dailyGames;
        } catch (error) {
            throw error;
        }
    }

    // READ ALL - 모든 일일 경기 데이터 조회
    async findAll() {
        try {
            const dailyGames = await this.collection.find({}).sort({ date: -1 }).toArray();
            return dailyGames;
        } catch (error) {
            throw error;
        }
    }

    // UPDATE - 특정 날짜의 경기 데이터 업데이트
    async update(date, games) {
        try {
            // 기존 데이터 확인
            const existingData = await this.collection.findOne({ date });
            if (!existingData) {
                throw new Error('업데이트할 데이터를 찾을 수 없습니다.');
            }

            // 5개 경기 데이터 업데이트
            const gameData = [];
            for (let i = 1; i <= 5; i++) {
                const game = games.find(g => g.number === i) || {
                    number: i,
                    homeTeam: null,
                    awayTeam: null,
                    startTime: null,
                    endTime: null,
                    status: '정상게임'
                };
                gameData.push(game);
            }

            const result = await this.collection.findOneAndUpdate(
                { date },
                { 
                    $set: { 
                        games: gameData,
                        updatedAt: new Date()
                    } 
                },
                { returnDocument: 'after' }
            );

            return result.value;
        } catch (error) {
            throw error;
        }
    }

    // DELETE - 특정 날짜의 경기 데이터 삭제
    async delete(date) {
        try {
            const deletedData = await this.collection.findOneAndDelete({ date });
            return deletedData.value;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = DailyGamesModel; 