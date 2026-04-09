import { PDFDocument } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const templateUrl = "https://media.base44.com/files/public/691521cbabed77e5043c7037/90efb151f_TestHH-Manchester-ECHNInvoicetemplate-ENTIC.pdf";"https://media.base44.com/files/public/691521cbabed77e5043c7037/f85160c21_TestHH-Manchester-ECHNInvoicetemplate-ENTIC.pdf";"https://media.base44.com/files/public/691521cbabed77e5043c7037/23b640b06_TestHH-Manchester-ECHNInvoicetemplate-ENTIC.pdf";
        
        const templateResponse = await fetch(templateUrl);
        if (!templateResponse.ok) {
            throw new Error(`Failed to fetch template: ${templateResponse.statusText}`);
        }
        const templateBuffer = await templateResponse.arrayBuffer();
        const pdfDoc = await PDFDocument.load(templateBuffer);
        const form = pdfDoc.getForm();
        
        const fields = form.getFields().map(f => ({
            name: f.getName(),
            type: f.constructor.name
        }));

        console.log("PDF Fields:", JSON.stringify(fields, null, 2));

        return Response.json({ fields });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});