import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const ITEM_CODES = `763-0012
570-2658
763-0012
261-0359
127-1284
112-6133
136-8412
261-0358
261-0360
118-3871
141-3550
763-0012
640-2805
116-9264
640-0075
678-3847
128-0385
112-7103
261-0359
763-0012
277-0068
136-8412
146-7091
140-9313
570-2874
640-2805
763-0012
116-9264
261-0359
261-0360
113-8356
570-0620
890-0590
831-0072
890-0590
136-8412
112-6077
112-6080
136-8412
261-0359
640-2805
146-7091
678-3847
570-2648
261-0358
112-7082
570-2658
831-0213
140-9313
763-0012
140-6885
136-8412
261-0359
261-0360
337-1026
570-2874
337-2091
337-5234
987-8204
112-6147
210-4020
140-9313
146-7355
116-9264
146-7091
100-7265
763-0012
261-0360
261-0359
640-2805
261-0358
570-2630
763-0012
566-8482
570-2874
277-0068
570-2119
118-3871
143-9429
640-0075
763-0012
570-2648
140-3081
337-8846
763-0012
261-0359
640-2805
261-0358
570-2874
261-0360
777-4451
261-0359
987-2059
566-5521
763-0012
116-9264
100-7265
831-0072
763-0012
261-0359
112-6133
570-2874
763-0012
890-8967
140-6885
116-9264
261-0359
337-0035
140-6885
136-8412
763-0012
640-2805
261-0359
136-8412
136-8412
261-0359
570-2648
112-6133
261-0359
640-2805
261-0358
261-0358
570-2874
261-0360
136-8412
100-7265
101-9673
108-4480
763-0012
112-6133
277-0068
108-4480
111-8537
261-0359
337-0035
140-6885
116-9264
136-8412`;

const DESCRIPTIONS = `Revital-Ox Resert XL HLD Disin 4liter
All-Gauze Sponge NS 12Ply 2x2''
Revital~Ox Resert XL HLD Disin 41iter
Velvet 300 Nitrile Glove Medium
Bandage lnexible Adhesive 2"x4"
Bandage Adhesive Fabric Strip lx3"
Emesis Basin 700mL Gold
Velvet 300 Nitrite Glove Small
Velvet 300 Nitrite Glove Large
Sponge Neuro Patties Sterile 0.5x3"
Nebulizer MicroMist 7' Tube
Revital-Ox Resert XL HLD Disin 41iter
CaviWipes Towelettes Disin Large
Sep-T-Vac System II 1200cc
EA Metrizyme Gal
Saline Normal ,9% II'rig Bottle lO0mL
Hydrogen Peroxide 3%
Needle Disposable 27gX1.25 27Gxl.25
Velvet 300 Nitrile Glove Medium
Revital-Ox Resert XL HLD Disin 41iter
Dexamethasone Ophth Sol 0.10%
Emesis Basin 700mL Gold
Paper Tape NS 1 uxlOY
15GMfl'll Bctamethasone Valerate Cream 0.1 %
Distilled Water 3L
CaviWipes Towelettes Disin Large
Revital~Ox Resert XL HLD Disin 41iter
Sep-T • Vac System II 1200cc
StarMed Plus PF Nibile Glove Medium
StarMed Plus PF Nitrile Glove Large
EA Timel' Digital 99 Min
Staple Remover Kit Sterile
10mx Gauze Sponge Cul'ity 16Ply 4x4"
Suture Removal Tray W/Forcep Iris&Ad
Gauze Sponge Curity 16Ply 4x4"
Emesis Basin 700mL Gold
Sphyg Essentials LF Navy Adult
Sphyg Essentials LF Navy Large Adult
Emesis Basin 700mL Gold
Velvet 300 Nitrile Glove Medium
CaviWipes Towelettes Disin Large
Paper Tape NS 1 "xlOY
Saline Solution 0.9% f/Irrigat l00mL
AIIMGauze Sponge NS 12Ply 3x3"
StarMed Plus PF Nitdle Glove Small
Critedon Polychlo Surg Glv Size7 .0
All-Gauze Sponge NS 12Ply 2x2"
EA Suture Removal Tray
Betametlmsone Valerate Cream 0.1 %
Revital-Ox Resert XL HLD Disin 4Iiter
Depressor Tongue 5.5" 5.5"
Emesis Basin 700mL Gold
StarMed Plus PF Nltrlle Glove Medium
30MIX StarMed Plus PF Nltrile Glove Large
Syringes Luer Lock 3cc
Distilled Water 3L
Needle Disposable 18Gxl.5
Needle Disposable 27Gxl.25
Needle Disposable 30Gx.5
Compress Cold Instant Disp S.S11xS11
Suture Removal Kit
15GMffB Betamethasone Valerate Cream 0,1 %
lOMLmT Ciprofloxacin HCI Ophth Sol 0.3%
Sep-T • Vac System II 1200cc
12mx Paper Tape NS 1 "xlOY
Dri-Gard Towel 2Ply+Poly Blue 13x19
Revital-Ox Resert XL HLD Disin 4liter
Star Med Plus PF Nitrilc Glove Large
StarMed Plus PF Nitrile Glove Medium
CaviWipes Towelettes Disin Large
StarMed Plus PF Nitrile Glove Small
All-Gauze Sponge NS 12Ply 4x4"
Revital-Ox Resert XL HLD Disin 4liter
Klcenspec Otoscope Specula 5mm
Distilled Water 3L
Dexamethasone Ophth Sol 0.10%
Syringe w/NDL SlipTip TB ICC 25Gx5/8
Sponge Neuro Patties Sterile 0.5x3"
7.5MLIBT cm· rofloxacin Dexa Otic Dro:ps 0.3/0.1 %
EA Metrizyme Gal
Revital-Ox Resert XL HLD Disin 4liter
All-Gauze Sponge NS 12Ply 3x3"
CaviWipes 2.0 Wipes 6"x6.75"
Syringes Eccentric Tip Disp 50cc
Revital~Ox Resert XL HLD Disin 41iter
Velvet 300 Nitrile Glove Medium
CaviWipes Towelettes Disin Large
Velvet 300 Nitrile Glove Small
Distilled Water 3L
Velvet 300 Nitrile Glove Large
Micropore Surgical Tape Tan ,S"xl0Y
Velvet 300 Nitrile Glove Medium
TB Syl'inges w/Needle Slip lee 25Gx5/8
Eat· Specula Disp KleenSpec 4mm
Revital-Ox Resert XL HLD Disin 4liter
Sep-T • Vac System II 1200cc
DriMGard Towel 2Ply+Poly Blue 13x19
EA Suture Removal Tray W/Forcep Iris&Ad
Revital-Ox Resert XL HLD Disin 41iter
Velvet 300 Nitrile Glove Medium
Bandage Adhesive Fabric Strip lx3'' •
Distilled Water 3L
Revital-Ox Resert XL lll,D Disin 41iter
Telfa Dressing Sterile l's 3"x4"
Tongue Depressor Junior NS 5.5"
Sep-T-Vac System II 1200cc
Velvet 300 Nitrile Glove Medium
Syringes Luer Lock 10cc
soomx Tongue Depressor Junior NS 5.5"
Emesis Basin 700mL Gold
Revital-Ox Resert XL IILD Disin 41iter
CaviWipes Towelettes Disin Large
Velvet 300 Nitrile Glove Medium
Emesis Basin 700mL Gold
Emesis Basin 700mL Gold
Velvet 300 Nitrile Glove Medium
All-Gauze Sponge NS 12Ply 3x3"
10omx Bandage Adhesive Fabric Strip lx3"
Velvet 300 Nitrile Glove Medium
CaviWipes Towelettes Disin Large
Velvet 300 Nitrile Glove Small
Velvet 300 Nitrile Glove Small
Distilled Water 3L
Velvet 300 Nitl'ile Glove Large
Emesis Basin 700mL Gold
Dri-Gard Towel 2Ply+Poly Blue 13x19
Paper Surgical Tape NS 1 "x10y
Xlim PF Nitl'ile Glove Exam MEDIUM
Revital-Ox Reser! XL HLD Disin 4liter
Bandage Adhesive Fabric Strip 1x311
Dexamethasone Ophth Sol 0.10%
Xlim PF Nitrile Glove Exam MEDIUM
Cl'iterion NlOO Glove Nitrile L
Velvet 300 Nitrile Glove Medium
lO0ffiX Syringes Luer Lock 10cc
Tongue Depressor Junior NS 5.5"
Sep-T-Vac System II 1200cc
Emesis Basin 700mL Gold`;

const PRICES = `$190.48
$1.94
$190.48
$17.00
$8.29
$2.00
$58.52
$17.23
$17.23
$103.42
$58.50
$190.48
$91.08
$218.40
$55.55
$74.00
$14.00
$7.90
$170.90
$190.48
$48.61
$58.52
$10.00
$5.02
$19.00
$91.00
$190.48
$218.40
$170.90
$170.90
$21.70
$71.52
$1.22
$156.00
$1.22
$58.00
$188.00
$221.00
$58.00
$170.90
$91.08
$11.00
$74.00
$65.20
$17.00
$56.00
$1.66
$1.03
$4.90
$190.48
$112.80
$58.52
$17.23
$17.00
$17.04
$19.00
$8.01
$8.01
$31.00
$30.29
$84.49
$4.90
$17.98
$218.40
$10.49
$30.56
$190.00
$17.23
$170.90
$91.08
$17.23
$63.70
$190.00
$38.00
$19.69
$48.61
$12.97
$103.42
$117.08
$53.31
$190.48
$79.20
$74.76
$42.77
$196.48
$142.00
$91.08
$14.25
$19.00
$14.25
$11.75
$142.50
$17.00
$36.02
$190.48
$228.00
$31.11
$1.56
$190.48
$170.90
$2.53
$19.69
$196.48
$11.54
$12.99
$228.00
$142.00
$30.10
$12.00
$58.52
$190.00
$91.08
$170.90
$58.00
$58.52
$170.90
$84.00
$2.53
$142.50
$91.08
$142.50
$14.25
$19.69
$14.25
$58.52
$31.11
$105.00
$87.40
$196.00
$2.53
$63.12
$87.40
$7.00
$142.50
$30.10
$12.99
$228.00
$58.52`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fix existing supplies (set to office if category missing)
    const existing = await base44.asServiceRole.entities.Supply.list();
    for (const s of existing) {
        if (!s.category) {
            await base44.asServiceRole.entities.Supply.update(s.id, { category: 'office' });
        }
    }

    // 2. Parse and insert clinical supplies
    const codes = ITEM_CODES.trim().split('\n').filter(l => l.trim() !== '');
    const descs = DESCRIPTIONS.trim().split('\n').filter(l => l.trim() !== '');
    const prices = PRICES.trim().split('\n').filter(l => l.trim() !== '');

    if (codes.length !== descs.length || codes.length !== prices.length) {
        return Response.json({ 
            error: `Mismatch in counts: Codes=${codes.length}, Descs=${descs.length}, Prices=${prices.length}` 
        }, { status: 400 });
    }

    let count = 0;
    for (let i = 0; i < codes.length; i++) {
        const price = parseFloat(prices[i].replace('$', '').trim());
        
        // Check if item already exists to prevent duplicates? 
        // For now, we'll just create it as requested.
        
        await base44.asServiceRole.entities.Supply.create({
            item_number: codes[i].trim(),
            product_name: descs[i].trim(),
            unit_price: price,
            codes: "",
            category: "clinical",
            vendor: "",
            units: ""
        });
        count++;
    }

    return Response.json({ 
      success: true,
      message: `Successfully updated existing office supplies and imported ${count} new clinical items.` 
    });

  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});