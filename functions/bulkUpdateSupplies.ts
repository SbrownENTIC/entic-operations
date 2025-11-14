import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const supplyData = [
  { item_number: "031307", product_name: "031307", unit_price: 8.69, units: "60/Pack" },
  { item_number: "034191", product_name: "034191", unit_price: 11.79, units: "25/Pack" },
  { item_number: "041302", product_name: "041302", unit_price: 39.59, units: "36/Pack" },
  { item_number: "050552", product_name: "050552", unit_price: 39.19, units: "36/Pack" },
  { item_number: "105738", product_name: "105738", unit_price: 0, units: "100 Sheets/Pad, 24 Pads/Pack" },
  { item_number: "105809", product_name: "105809", unit_price: 8.89, units: "100 Sheets/Pad, 12 Pads/Pack" },
  { item_number: "1149611", product_name: "1149611", unit_price: 40.49, units: "500 Sheets/Ream, 8 Reams/Carton" },
  { item_number: "125369", product_name: "125369", unit_price: 12.89, units: "12/Pack" },
  { item_number: "134411", product_name: "134411", unit_price: 22.99, units: "" },
  { item_number: "163873", product_name: "163873", unit_price: 7.79, units: "50 Sheets/Pad, Dozen" },
  { item_number: "166223", product_name: "166223", unit_price: 4.99, units: "250/Pack" },
  { item_number: "181844", product_name: "181844", unit_price: 18.39, units: "20 Bags/Box" },
  { item_number: "2105748", product_name: "2105748", unit_price: 15.99, units: "24/Box" },
  { item_number: "2411484", product_name: "2411484", unit_price: 87.99, units: "250 Napkins/Pack, 24/Carton" },
  { item_number: "24297293", product_name: "24297293", unit_price: 0, units: "" },
  { item_number: "2432877", product_name: "2432877", unit_price: 18.09, units: "180/Carton" },
  { item_number: "24341276", product_name: "24341276", unit_price: 0, units: "4/Pack" },
  { item_number: "24360009", product_name: "24360009", unit_price: 36.49, units: "360/Carton" },
  { item_number: "24360010", product_name: "24360010", unit_price: 31.59, units: "360/Carton" },
  { item_number: "24372866", product_name: "24372866", unit_price: 18.49, units: "50/Box" },
  { item_number: "24372868", product_name: "24372868", unit_price: 23.29, units: "60/Box" },
  { item_number: "24374715", product_name: "24374715", unit_price: 5.09, units: "" },
  { item_number: "24375255", product_name: "24375255", unit_price: 32.39, units: "500/Carton" },
  { item_number: "24375257", product_name: "24375257", unit_price: 34.99, units: "500/Carton" },
  { item_number: "24375262", product_name: "24375262", unit_price: 51.79, units: "500/Carton" },
  { item_number: "24375263", product_name: "24375263", unit_price: 16.44, units: "125/Pack" },
  { item_number: "24377965", product_name: "24377965", unit_price: 18.29, units: "6/Carton" },
  { item_number: "24388084", product_name: "24388084", unit_price: 128.19, units: "4/Pack" },
  { item_number: "24388085", product_name: "24388085", unit_price: 128.29, units: "4/Pack" },
  { item_number: "24388155", product_name: "24388155", unit_price: 19.19, units: "1000/Carton" },
  { item_number: "24388156", product_name: "24388156", unit_price: 18.59, units: "500/Carton" },
  { item_number: "24388157", product_name: "24388157", unit_price: 19.09, units: "500/Carton" },
  { item_number: "24388158", product_name: "24388158", unit_price: 49.99, units: "500/Carton" },
  { item_number: "24388159", product_name: "24388159", unit_price: 4.89, units: "125/Pack" },
  { item_number: "24388160", product_name: "24388160", unit_price: 5.79, units: "125/Pack" },
  { item_number: "24390987", product_name: "24390987", unit_price: 13.85, units: "300/Pack" },
  { item_number: "24390989", product_name: "24390989", unit_price: 23.59, units: "1000/Pack" },
  { item_number: "24390991", product_name: "24390991", unit_price: 8.79, units: "300/Pack" },
  { item_number: "24390992", product_name: "24390992", unit_price: 46.19, units: "1000/Pack" },
  { item_number: "24390994", product_name: "24390994", unit_price: 4.59, units: "100/Pack" },
  { item_number: "24390995", product_name: "24390995", unit_price: 11.99, units: "1000/Pack" },
  { item_number: "24390996", product_name: "24390996", unit_price: 4.59, units: "100/Pack" },
  { item_number: "24390998", product_name: "24390998", unit_price: 11.99, units: "1000/Pack" },
  { item_number: "24391000", product_name: "24391000", unit_price: 11.99, units: "1000/Pack" },
  { item_number: "24391001", product_name: "24391001", unit_price: 16.59, units: "300/Pack" },
  { item_number: "24391002", product_name: "24391002", unit_price: 16.59, units: "1000/Carton" },
  { item_number: "24391003", product_name: "24391003", unit_price: 6.19, units: "100/Pack" },
  { item_number: "24391004", product_name: "24391004", unit_price: 11.99, units: "1000/Pack" },
  { item_number: "24391005", product_name: "24391005", unit_price: 4.59, units: "100/Pack" },
  { item_number: "24391006", product_name: "24391006", unit_price: 4.59, units: "100/Pack" },
  { item_number: "24393963", product_name: "24393963", unit_price: 8.62, units: "100/Pack" },
  { item_number: "24393964", product_name: "24393964", unit_price: 10.29, units: "50/Pack" },
  { item_number: "24395089", product_name: "24395089", unit_price: 11.89, units: "3/Pack" },
  { item_number: "24404337", product_name: "24404337", unit_price: 5.69, units: "50/Pack" },
  { item_number: "24405545", product_name: "24405545", unit_price: 31.19, units: "100 Sheets/Box, 30 Boxes/Carton" },
  { item_number: "24405547", product_name: "24405547", unit_price: 37.69, units: "100 Sheets/Box, 30 Boxes/Carton" },
  { item_number: "24405549", product_name: "24405549", unit_price: 24.79, units: "100 Sheets/Box, 30 Boxes/Carton" },
  { item_number: "24419917", product_name: "24419917", unit_price: 9.49, units: "50 Sheets/Pad, Dozen" },
  { item_number: "24451934", product_name: "24451934", unit_price: 44.09, units: "4/Pack" },
  { item_number: "24462270", product_name: "24462270", unit_price: 78.69, units: "12/Carton" },
  { item_number: "24526131", product_name: "24526131", unit_price: 233.09, units: "" },
  { item_number: "24526134", product_name: "24526134", unit_price: 127.19, units: "" },
  { item_number: "24526138", product_name: "24526138", unit_price: 205.99, units: "3/Pack" },
  { item_number: "24533819", product_name: "24533819", unit_price: 0, units: "" },
  { item_number: "24534139", product_name: "24534139", unit_price: 18.59, units: "100 Sheets/Pad, 24 Pads/Pack" },
  { item_number: "24538304", product_name: "24538304", unit_price: 28.39, units: "48/Box" },
  { item_number: "24543257", product_name: "24543257", unit_price: 8.79, units: "50/Box" },
  { item_number: "24551751", product_name: "24551751", unit_price: 22.39, units: "6000/Carton" },
  { item_number: "24567949", product_name: "24567949", unit_price: 19.29, units: "6/Carton" },
  { item_number: "24580731", product_name: "24580731", unit_price: 19.59, units: "6/Carton" },
  { item_number: "24588612", product_name: "24588612", unit_price: 8.89, units: "1000/Pack" },
  { item_number: "24588623", product_name: "24588623", unit_price: 12.79, units: "4/Carton" },
  { item_number: "24589288", product_name: "24589288", unit_price: 22.09, units: "" },
  { item_number: "24598608", product_name: "24598608", unit_price: 69.39, units: "144/Pack" },
  { item_number: "24602153", product_name: "24602153", unit_price: 14.19, units: "3/Pack" },
  { item_number: "24616449", product_name: "24616449", unit_price: 2.89, units: "100 Sheets/Pad, 12 Pads/Pack" },
  { item_number: "24616453", product_name: "24616453", unit_price: 6.89, units: "100 Sheets/Pad, 6 Pads/Pack" },
  { item_number: "24619088", product_name: "24619088", unit_price: 0, units: "8/Pack" },
  { item_number: "24622889", product_name: "24622889", unit_price: 0, units: "8/Pack" },
  { item_number: "24629134", product_name: "24629134", unit_price: 15.69, units: "" },
  { item_number: "24630092", product_name: "24630092", unit_price: 12.99, units: "75/Pack" },
  { item_number: "24633719", product_name: "24633719", unit_price: 19.96, units: "12 Double Rolls" },
  { item_number: "2522115", product_name: "2522115", unit_price: 5.39, units: "" },
  { item_number: "260696", product_name: "260696", unit_price: 58.09, units: "96/Carton" },
  { item_number: "2622610", product_name: "2622610", unit_price: 8.79, units: "24/Pack" },
  { item_number: "2646682", product_name: "2646682", unit_price: 60.99, units: "88/Carton" },
  { item_number: "2646683", product_name: "2646683", unit_price: 68.79, units: "88/Carton" },
  { item_number: "271674", product_name: "271674", unit_price: 17.39, units: "36/Pack" },
  { item_number: "2756591", product_name: "2756591", unit_price: 2.99, units: "" },
  { item_number: "2759026", product_name: "2759026", unit_price: 36.29, units: "70/Box" },
  { item_number: "2860762", product_name: "2860762", unit_price: 12.49, units: "" },
  { item_number: "325403", product_name: "325403", unit_price: 17.89, units: "24/Box" },
  { item_number: "365374", product_name: "365374", unit_price: 39.29, units: "250 Sheets/Pack, 16 Packs/Carton" },
  { item_number: "373454", product_name: "373454", unit_price: 27.09, units: "250 Sheets/Pack, 16 Packs/Carton" },
  { item_number: "373470", product_name: "373470", unit_price: 26.89, units: "250 Sheets/Pack, 16 Packs/Carton" },
  { item_number: "375469", product_name: "375469", unit_price: 52.09, units: "12/Carton" },
  { item_number: "375472", product_name: "375472", unit_price: 31.99, units: "4/Carton" },
  { item_number: "378813", product_name: "378813", unit_price: 3.09, units: "60 Clips/Pack" },
  { item_number: "432282", product_name: "432282", unit_price: 17.69, units: "150 Bags/Box" },
  { item_number: "442901", product_name: "442901", unit_price: 6.49, units: "60 Pack" },
  { item_number: "447951", product_name: "447951", unit_price: 11.79, units: "20/Pack" },
  { item_number: "464050", product_name: "464050", unit_price: 25.49, units: "36/Pack" },
  { item_number: "470745", product_name: "470745", unit_price: 27.09, units: "12 Boxes/Carton" },
  { item_number: "478451", product_name: "478451", unit_price: 19.89, units: "" },
  { item_number: "483018", product_name: "483018", unit_price: 15.39, units: "10/Pack" },
  { item_number: "486330", product_name: "486330", unit_price: 0, units: "200/Box" },
  { item_number: "487908", product_name: "487908", unit_price: 18.29, units: "12 Rolls/Pack" },
  { item_number: "495492", product_name: "495492", unit_price: 15.09, units: "6/Pack" },
  { item_number: "497049", product_name: "497049", unit_price: 9.19, units: "" },
  { item_number: "503405", product_name: "503405", unit_price: 64.09, units: "12 Rolls/Case" },
  { item_number: "508804", product_name: "508804", unit_price: 19.29, units: "100/Pack" },
  { item_number: "522569", product_name: "522569", unit_price: 17.49, units: "50/Box" },
  { item_number: "525923", product_name: "525923", unit_price: 2.59, units: "100 Clips/Pack" },
  { item_number: "538611", product_name: "538611", unit_price: 17.19, units: "1000/Carton" },
  { item_number: "539073", product_name: "539073", unit_price: 66.19, units: "96/Carton" },
  { item_number: "559218", product_name: "559218", unit_price: 13.49, units: "Dozen" },
  { item_number: "565447", product_name: "565447", unit_price: 4.59, units: "100 Sheets/Pad, 12 Pads/Pack" },
  { item_number: "607873", product_name: "607873", unit_price: 98.29, units: "12/Carton" },
  { item_number: "609710", product_name: "609710", unit_price: 7.89, units: "24/Pack" },
  { item_number: "609712", product_name: "609712", unit_price: 7.89, units: "24/Pack" },
  { item_number: "635937", product_name: "635937", unit_price: 13.99, units: "50/Box" },
  { item_number: "670087", product_name: "670087", unit_price: 3.19, units: "" },
  { item_number: "707197", product_name: "707197", unit_price: 16.89, units: "24/Box" },
  { item_number: "712332", product_name: "712332", unit_price: 12.49, units: "2/Pack" },
  { item_number: "716304", product_name: "716304", unit_price: 7.09, units: "" },
  { item_number: "716312", product_name: "716312", unit_price: 5.59, units: "" },
  { item_number: "751160", product_name: "751160", unit_price: 8.59, units: "" },
  { item_number: "812927", product_name: "812927", unit_price: 71.59, units: "750 Sheets/Roll, 36 Rolls/Carton" },
  { item_number: "812938", product_name: "812938", unit_price: 71.59, units: "750 Sheets/Roll, 36 Rolls/Carton" },
  { item_number: "814865", product_name: "814865", unit_price: 37.79, units: "150 Bags/Box" },
  { item_number: "817196", product_name: "817196", unit_price: 4.79, units: "" },
  { item_number: "818798", product_name: "818798", unit_price: 8.89, units: "50 Sheets/Pad, 12 Pads/Pack" },
  { item_number: "831293", product_name: "831293", unit_price: 13.49, units: "Dozen" },
  { item_number: "831602", product_name: "831602", unit_price: 6.99, units: "24 Clips/Pack" },
  { item_number: "831610", product_name: "831610", unit_price: 2.79, units: "12 Clips/Pack" },
  { item_number: "847252", product_name: "847252", unit_price: 34.69, units: "1000 Bags/Box" },
  { item_number: "860124", product_name: "860124", unit_price: 3.49, units: "10/Pack" },
  { item_number: "865800", product_name: "865800", unit_price: 57.79, units: "96/Carton" },
  { item_number: "865930", product_name: "865930", unit_price: 63.19, units: "96/Carton" },
  { item_number: "865956", product_name: "865956", unit_price: 63.09, units: "96/Carton" },
  { item_number: "867473", product_name: "867473", unit_price: 21.99, units: "24/Pack" },
  { item_number: "870957", product_name: "870957", unit_price: 10.09, units: "" },
  { item_number: "875411", product_name: "875411", unit_price: 11.99, units: "Box of 25" },
  { item_number: "887586", product_name: "887586", unit_price: 5.19, units: "50/Pack" },
  { item_number: "887835", product_name: "887835", unit_price: 24.49, units: "1000 ft./Roll, 6 Rolls/Case" },
  { item_number: "887839", product_name: "887839", unit_price: 46.49, units: "250 Sheets/Pack, 16 Packs/Carton" },
  { item_number: "887844", product_name: "887844", unit_price: 6.09, units: "400 Napkins/Pack" },
  { item_number: "887845", product_name: "887845", unit_price: 35.59, units: "250 Sheets/Pack, 16 Packs/Carton" },
  { item_number: "887849", product_name: "887849", unit_price: 39.99, units: "250 Sheets/Pack, 16 Packs/Carton" },
  { item_number: "910543", product_name: "910543", unit_price: 26.09, units: "180/Box" },
  { item_number: "910546", product_name: "910546", unit_price: 20.59, units: "180/Box" },
  { item_number: "913923", product_name: "913923", unit_price: 9.49, units: "" },
  { item_number: "951060", product_name: "951060", unit_price: 13.79, units: "6/Pack" },
  { item_number: "CPCUS06022A", product_name: "CPCUS06022A", unit_price: 33.42, units: "9/Carton" }
];

// Helper function to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all supplies
    const supplies = await base44.asServiceRole.entities.Supply.list();
    
    let updated = 0;
    let notFound = [];
    
    // Process sequentially with delays to avoid rate limits
    for (let i = 0; i < supplyData.length; i++) {
      const data = supplyData[i];
      const supply = supplies.find(s => s.item_number === data.item_number);
      
      if (supply) {
        await base44.asServiceRole.entities.Supply.update(supply.id, {
          product_name: data.product_name,
          unit_price: data.unit_price,
          units: data.units || null
        });
        updated++;
      } else {
        notFound.push(data.item_number);
      }
      
      // Add a small delay after every 5 updates
      if ((i + 1) % 5 === 0) {
        await delay(500);
      }
    }

    return Response.json({
      success: true,
      updated,
      total: supplyData.length,
      notFound: notFound.length > 0 ? notFound : undefined
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});