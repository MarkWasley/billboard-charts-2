const cheerio = require('cheerio');
const fs = require('fs');
const { DateTime } = require('luxon');

const COUNTRY_SONGS_URL = 'https://www.billboard.com/charts/country-songs/';
const COUNTRY_AIRPLAY_URL = 'https://www.billboard.com/charts/country-airplay/';
const TIMEZONE = 'Pacific/Auckland';

const removeLineFeed = (str) => str.replace(/\n/g, '').replace(/\t/g, '');

async function saveChart(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        const now = DateTime.now().setZone(TIMEZONE);
        const currentDayOfWeek = now.weekday;

        let daysToAdd = 6 - currentDayOfWeek;

        // On Monday and Tuesday, get the date from last Saturday because a new chart hasn't been published yet
        if (currentDayOfWeek <= 2) {
            daysToAdd = -(currentDayOfWeek + 1);
        }

        const chart = {
            date: now.plus({ days: daysToAdd }).startOf('day').toISODate(),
            entries: []
        };

        $('.o-chart-results-list-row-container').each((index, element) => {
            const lastWeekRank = removeLineFeed($('.o-chart-results-list__item:nth-child(4) > span', element).first().text());
            const title = removeLineFeed($(element).find('h3#title-of-a-story').first().text());
            const artist = removeLineFeed($(element).find('h3 + span.c-label').text());
            const rank = index + 1;
            const last_week_rank = lastWeekRank === '-' ? null : Number(lastWeekRank);
            const peakRank = Number(removeLineFeed($(element).find('.o-chart-results-list__item:nth-child(5) > span').first().text()));
            const weeksOnChart = Number(removeLineFeed($(element).find('.o-chart-results-list__item:nth-child(6) > span').first().text()));
            const image = $('img', element).first().attr('data-lazy-src') || null;

            chart.entries.push({
                name: title,
                artist: artist,
                image: image,
                rank: rank,
                last_week_rank: last_week_rank,
                peak_rank: peakRank,
                weeks_on_chart: weeksOnChart
            });
        });

        let chartType = 'Country';
        let latestFilePath = 'latest.json';
        let dateFilePathPrefix = '';

        switch (url) {
            case COUNTRY_AIRPLAY_URL:
                chartType = 'Country Airplay';
                latestFilePath = 'latest-airplay.json';
                dateFilePathPrefix = 'airplay-';
        }

        if (fs.existsSync(latestFilePath)) {
            const existingData = JSON.parse(fs.readFileSync(latestFilePath, 'utf8'));
            fs.renameSync(latestFilePath, `${dateFilePathPrefix}${existingData.date}.json`);
            console.log(`Renaming ${existingData.date} ${chartType} chart to ${dateFilePathPrefix}${existingData.date}.json.`);
        }

        fs.writeFileSync(latestFilePath, JSON.stringify(chart, null, '\t'));
        console.log(`New ${chartType} chart data saved successfully.`);
    } catch (error) {
        console.error(`Error getting chart data from Billboard:`, error);
    }
}

async function main() {
    await saveChart(COUNTRY_SONGS_URL);
    await saveChart(COUNTRY_AIRPLAY_URL);
}

main();