const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const createCsvWriter = require('csv-writer').createObjectCsvWriter;


function parsePractitionersList(htmlContent, baseUrl = 'https://www.adgm.com') {
    const $ = cheerio.load(htmlContent);
    const practitioners = [];
  
    $('.every-accord').each((index, element) => {
      const practitioner = {};
      
      practitioner.name = $(element).find('.opn-accord .col-md-4').text().trim();
      practitioner.registrationNumber = $(element).find('.opn-accord .col-md-3:first').text().trim();
      practitioner.dateOfRegistration = $(element).find('.opn-accord .col-md-3:last').text().trim();
  
      // Extract the link
      const linkHref = $(element).find('.click a').attr('href');
      practitioner.link = linkHref ? `${baseUrl}${linkHref}` : null;
  
      $(element).find('.information').each((i, info) => {
        const key = $(info).find('.col-sm-6:first').text().trim().replace(/\s+/g, '_').toLowerCase();
        const value = $(info).find('.col-sm-6:last').text().trim();
        practitioner[key] = value;
      });
  
      practitioners.push(practitioner);
    });
  
    return practitioners;
  }
  
  
async function getPractitionersList(page, pageSize = 10) {
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://www.adgm.com/api/RegisterOfInsolvencyPractitioners/GetInsolvencyPractitioners?sc_itemid=0a357a20-c08e-4db6-a2ab-e72afd4b9d86&sc_mode=normal&pageNumber=${page}&pageSize=${pageSize}&query=&orderByField=custom_sort_title_s&orderDesc=false`,
      headers: { 
        'accept': '*/*', 
        'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
        'cache-control': 'no-cache', 
        'dnt': '1', 
        'pragma': 'no-cache', 
        'priority': 'u=1, i', 
        'referer': 'https://www.adgm.com/operating-in-adgm/insolvency-practitioners/register-of-insolvency-practitioners', 
        'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"', 
        'sec-ch-ua-mobile': '?0', 
        'sec-ch-ua-platform': '"Windows"', 
        'sec-fetch-dest': 'empty', 
        'sec-fetch-mode': 'cors', 
        'sec-fetch-site': 'same-origin', 
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 
        'x-requested-with': 'XMLHttpRequest', 
        'Cookie': 'ASP.NET_SessionId=3epzzifawutuj1vd1qxc1upr; SC_ANALYTICS_GLOBAL_COOKIE=e3e8a900f47d49efa098a5b3d735a98e|False; adgm#sc_mode=normal'
      }
    };
  
    try {
      const response = await axios.request(config);
      const htmlContent = response.data.tableResult;
      const practitioners = parsePractitionersList(htmlContent);
      return practitioners;
    } catch (error) {
      console.error('Error fetching practitioners list:', error);
      throw error;
    }
  }

  async function fetchPractitionerDetails(url) {
    try {
      const response = await axios.get(url, {
        headers: { 
          'accept': '*/*', 
          'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
          'cache-control': 'no-cache', 
          'dnt': '1', 
          'pragma': 'no-cache', 
          'priority': 'u=1, i', 
          'referer': 'https://www.adgm.com/operating-in-adgm/insolvency-practitioners/register-of-insolvency-practitioners', 
          'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"', 
          'sec-ch-ua-mobile': '?0', 
          'sec-ch-ua-platform': '"Windows"', 
          'sec-fetch-dest': 'empty', 
          'sec-fetch-mode': 'cors', 
          'sec-fetch-site': 'same-origin', 
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 
          'x-requested-with': 'XMLHttpRequest', 
          'Cookie': 'ASP.NET_SessionId=3epzzifawutuj1vd1qxc1upr; SC_ANALYTICS_GLOBAL_COOKIE=e3e8a900f47d49efa098a5b3d735a98e|False; adgm#sc_mode=normal'
        }
      });
      const $ = cheerio.load(response.data);
      const detailsSection = $('#main-container > main > section.s-table-fsp');
      const details = {};
  
      detailsSection.find('.col-sm-12').each((index, element) => {
        const key = $(element).find('.col-sm-6:first').text().trim().replace(/\s+/g, '_').toLowerCase();
        const value = $(element).find('.col-sm-6:last').text().trim();
        if (key && value) {
          details[key] = value;
        }
      });
  
      return details;
    } catch (error) {
      console.error(`Error fetching details for ${url}:`, error);
      return null;
    }
  }

  function reorganizePractitionerData(practitioner) {
    return {
      name: practitioner.name,
      registrationNumber: practitioner.registrationNumber,
      dateOfRegistration: practitioner.dateOfRegistration,
      email: practitioner.email,
      phone: practitioner.call,
      employerName: practitioner.insolvency_practitioner_employer_name,
      employerRegistrationNumber: practitioner.registered_number_of_the_employer,
      businessAddress: practitioner.business_address,
      serviceAddress: practitioner.service_address,
      websiteAddress: practitioner.website_address,
      profileLink: practitioner.link
    };
  }

  async function run() {
  let page = 1;
  const pageSize = 10;
  let allPractitioners = [];
  let practitioners;

  do {
    try {
      practitioners = await getPractitionersList(page, pageSize);
      allPractitioners = allPractitioners.concat(practitioners);
      console.log(`Fetched ${practitioners.length} practitioners from page ${page}`);
      page++;
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      break;
    }
  } while (practitioners.length === pageSize);

  console.log(`Total practitioners fetched: ${allPractitioners.length}`);

  // Fetch detailed information for each practitioner
  for (let i = 0; i < allPractitioners.length; i++) {
    const practitioner = allPractitioners[i];
    console.log(`Fetching details for ${practitioner.name} (${i + 1}/${allPractitioners.length})`);
    const details = await fetchPractitionerDetails(practitioner.link);
    if (details) {
      allPractitioners[i] = { ...practitioner, ...details };
    }
  }

  // Reorganize the data
  const reorganizedData = allPractitioners.map(reorganizePractitionerData);

  return reorganizedData;
}

// Execute the run function
run().then(async result => {
  console.log('Scraping completed');
  const folderPath = path.join(__dirname, 'practitioners');
  const jsonFilePath = path.join(folderPath, 'practitioners_details.json');
  const csvFilePath = path.join(folderPath, 'practitioners_details.csv');
  
  try {
    await fs.mkdir(folderPath, { recursive: true });

    // Save as JSON
    await fs.writeFile(jsonFilePath, JSON.stringify(result, null, 2));
    console.log(`Practitioners details saved to ${jsonFilePath}`);

    // Save as CSV
    const csvWriter = createCsvWriter({
      path: csvFilePath,
      header: [
        {id: 'name', title: 'Name'},
        {id: 'registrationNumber', title: 'Registration Number'},
        {id: 'dateOfRegistration', title: 'Date of Registration'},
        {id: 'email', title: 'Email'},
        {id: 'phone', title: 'Phone'},
        {id: 'employerName', title: 'Employer Name'},
        {id: 'employerRegistrationNumber', title: 'Employer Registration Number'},
        {id: 'businessAddress', title: 'Business Address'},
        {id: 'serviceAddress', title: 'Service Address'},
        {id: 'websiteAddress', title: 'Website Address'},
        {id: 'profileLink', title: 'Profile Link'}
      ]
    });

    await csvWriter.writeRecords(result);
    console.log(`Practitioners details saved to ${csvFilePath}`);
  } catch (error) {
    console.error('Error saving practitioners details:', error);
  }
}).catch(error => {
  console.error('An error occurred during scraping:', error);
});
