const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const pLimit = require('p-limit');

const createCsvWriter = require('csv-writer').createObjectCsvWriter;

function parseCompanyList(htmlContent, baseUrl = 'https://www.adgm.com') {
    const $ = cheerio.load(htmlContent);
    const companies = [];
  
    $('.fsp-second-table .every-accord').each((index, element) => {
      const company = {};
      
      company.name = $(element).find('.col-md-4.col-lg-5').text().trim();
      company.permissionNumber = $(element).find('.col-md-3.col-lg-2').text().trim();
  
      // Extract the link
      const linkHref = $(element).find('.click a').attr('href');
      company.link = linkHref ? `${baseUrl}${linkHref}` : null;
  
      $(element).find('.information').each((i, info) => {
        const key = $(info).find('.col-sm-6:first').text().trim().replace(/\s+/g, '_').toLowerCase();
        const value = $(info).find('.col-sm-6:last').text().trim();
        company[key] = value;
      });
  
      companies.push(company);
    });
  
    return companies;
  }
  
async function getCompanyList(page, pageSize = 10) {
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://www.adgm.com/api/fsf/GetFirms?sc_itemid=fcea6284-884f-40f5-a6ba-f2179587e043&sc_mode=normal&pageNumber=${page}&pageSize=${pageSize}&companyStatus=&regulatedActivity=&query=&orderByField=name_srt&orderDesc=false`,
      headers: { 
        'accept': '*/*', 
        'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
        'cache-control': 'no-cache', 
        'dnt': '1', 
        'pragma': 'no-cache', 
        'priority': 'u=1, i', 
        'referer': 'https://www.adgm.com/public-registers/fsra', 
        'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"', 
        'sec-ch-ua-mobile': '?0', 
        'sec-ch-ua-platform': '"Windows"', 
        'sec-fetch-dest': 'empty', 
        'sec-fetch-mode': 'cors', 
        'sec-fetch-site': 'same-origin', 
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 
        'x-requested-with': 'XMLHttpRequest', 
        'Cookie': 'adgm#sc_mode=normal'      }
    };
  
    try {
      const response = await axios.request(config);
      const htmlContent = response.data.tableResult;

      const companies = parseCompanyList(htmlContent);
      console.log(companies);
      return companies;
    } catch (error) {
      console.error('Error fetching company list:', error);
      throw error;
    }
  }

  async function fetchCompanyDetails(url, company) {
    try {
      const response = await axios.get(url, {
        headers: { 
          'accept': '*/*', 
          'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
          'cache-control': 'no-cache', 
          'dnt': '1', 
          'pragma': 'no-cache', 
          'priority': 'u=1, i', 
          'referer': 'https://www.adgm.com/public-registers/fsra', 
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
      const detailsSection = $('#main-container > main > section:nth-child(9) > section.fsp-first-table');
      const details = {};
      detailsSection.find('.col-sm-12').each((index, element) => {
        const key = $(element).find('.col-sm-6:first').text().trim().replace(/\s+/g, '_').toLowerCase();
        let value = $(element).find('.col-sm-6:last').text().trim();
        
        if (key === 'email' || key === 'phone') {
          const anchorTag = $(element).find('.col-sm-6:last a');
          if (anchorTag.length > 0) {
            if (key === 'email') {
              value = anchorTag.attr('href').replace('mailto:', '');
            } else {
              value = anchorTag.text().trim();
            }
          }
        }
        
        if (key === 'email' && value.includes('<a href="mailto:')) {
          const emailMatch = value.match(/mailto:([^"]+)/);
          if (emailMatch) {
            value = emailMatch[1];
          }
        }
        
        if (key && value) {
          details[key] = value;
        }
      });
      console.log({...company, details})
      return details;
    } catch (error) {
      console.error(`Error fetching details for ${url}:`, error);
      return null;
    }
  }
  
  function reorganizeCompanyData(company) {
    return {
      name: company.name || 'NA',
      permissionNumber: company.permissionNumber || 'NA',
      link: company.link || 'NA',
      financial_services_permission_number: company.financial_services_permission_number || 'NA',
      company_status: company.company_status || 'NA',
      address: company.address || 'NA',
      date_of_financial_services_permission: company.date_of_financial_services_permission || 'NA',
      legal_status: company.legal_status || 'NA',
      phone: company.phone || 'NA',
      email: company.email || 'NA'
    };
  }
  
  async function run() {
    const companiesFolder = path.join(__dirname, 'companies');
    const companiesFilePath = path.join(companiesFolder, 'companies_list.json');
    let allCompanies = [];
  
    try {
      await fs.access(companiesFilePath);
      console.log('companies_list.json exists. Loading existing data...');
      const fileContent = await fs.readFile(companiesFilePath, 'utf8');
      allCompanies = JSON.parse(fileContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('companies_list.json does not exist. Fetching new data...');
        let page = 1;
        const pageSize = 10;
        let companies;
  
        do {
          try {
            companies = await getCompanyList(page, pageSize);
            allCompanies = allCompanies.concat(companies);
            console.log(`Fetched ${companies.length} companies from page ${page}`);
            page++;
          } catch (error) {
            console.error(`Error fetching page ${page}:`, error);
            break;
          }
     } while (companies.length === pageSize);
  
        console.log(`Total companies fetched: ${allCompanies.length}`);
  
        await fs.mkdir(companiesFolder, { recursive: true });
        await fs.writeFile(companiesFilePath, JSON.stringify(allCompanies, null, 2));
        console.log(`Companies list saved to ${companiesFilePath}`);
      } else {
        console.error('Error accessing companies_list.json:', error);
      }
    }
  
    // Fetch detailed information for each company concurrently with a limit of 5
    const limit = pLimit(5);
    const detailPromises = allCompanies.map((company, index) => 
      limit(async () => {
        console.log(`Fetching details for ${company.name} (${index + 1}/${allCompanies.length})`);
        const details = await fetchCompanyDetails(company.link, company);
        if (details) {
          return { ...company, ...details };
        }

        return company;
      })
    );
  
    allCompanies = await Promise.all(detailPromises);
    
    // Reorganize the data
    const reorganizedData = allCompanies.map(reorganizeCompanyData);
  
    return reorganizedData;
  }
  
  // Execute the run function
  run().then(async result => {
    console.log('Scraping completed');
    const folderPath = path.join(__dirname, 'companies');
    const jsonFilePath = path.join(folderPath, 'company_details.json');
    const csvFilePath = path.join(folderPath, 'company_details.csv');
    
    try {
      await fs.mkdir(folderPath, { recursive: true });
  
      // Save as JSON
      await fs.writeFile(jsonFilePath, JSON.stringify(result, null, 2));
      console.log(`Company details saved to ${jsonFilePath}`);
  
      // Save as CSV
      const csvWriter = createCsvWriter({
        path: csvFilePath,
        header: [
          {id: 'name', title: 'Name'},
          {id: 'permissionNumber', title: 'Permission Number'},
          {id: 'link', title: 'Link'},
          {id: 'financial_services_permission_number', title: 'Financial Services Permission Number'},
          {id: 'company_status', title: 'Company Status'},
          {id: 'address', title: 'Address'},
          {id: 'date_of_financial_services_permission', title: 'Date of Financial Services Permission'},
          {id: 'legal_status', title: 'Legal Status'},
          {id: 'phone', title: 'Phone'},
          {id: 'email', title: 'Email'}
        ]
      });
  
      await csvWriter.writeRecords(result);
      console.log(`Company details saved to ${csvFilePath}`);
    } catch (error) {
      console.error('Error saving company details:', error);
    }
  }).catch(error => {
    console.error('An error occurred during scraping:', error);
  });