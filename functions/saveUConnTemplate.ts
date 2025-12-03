import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // The URL provided
        const templateUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/5b1f5b2f6_MasterUConnServiceInvoice.pdf";
        
        // Fetch the PDF
        const response = await fetch(templateUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // Convert to base64 for upload
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64File = btoa(binary);

        // Upload to Private Storage
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
            file: base64File
        });

        return Response.json({ 
            message: "Template saved successfully", 
            file_uri: uploadRes.file_uri 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});